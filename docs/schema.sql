-- ============================================================
-- Sllr x Supplier shared warehouse — full schema
-- Paste into Supabase SQL editor and run once.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
do $$ begin
  create type app_role as enum ('sllr','supplier','admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum ('pending','approved','rejected','cancelled','consumed');
exception when duplicate_object then null; end $$;

-- ---------- suppliers ----------
create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text,
  created_at  timestamptz not null default now()
);

-- ---------- profiles (1:1 with auth.users) ----------
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  full_name    text,
  role         app_role not null default 'sllr',
  supplier_id  uuid references suppliers(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint supplier_must_have_org check (role <> 'supplier' or supplier_id is not null)
);

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- products ----------
create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references suppliers(id) on delete cascade,
  name           text not null,
  sku            text not null,
  warehouse_code text not null,
  image_url      text,
  total_qty      integer not null default 0 check (total_qty >= 0),
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (supplier_id, sku)
);

create index if not exists products_supplier_idx on products(supplier_id);
create index if not exists products_code_idx on products(warehouse_code);

-- ---------- reserve requests ----------
create table if not exists reserve_requests (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references products(id) on delete cascade,
  requested_by   uuid not null references profiles(id),
  qty_requested  integer not null check (qty_requested > 0),
  qty_approved   integer check (qty_approved >= 0),
  status         request_status not null default 'pending',
  hold_until     date,
  note           text,
  decided_by     uuid references profiles(id),
  decided_at     timestamptz,
  decision_note  text,
  created_at     timestamptz not null default now(),
  constraint approved_needs_qty check (status <> 'approved' or qty_approved is not null)
);

create index if not exists rr_product_status_idx on reserve_requests(product_id, status);
create index if not exists rr_status_idx on reserve_requests(status);

-- ---------- stock movement audit ----------
create table if not exists stock_movements (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id) on delete cascade,
  delta       integer not null,
  qty_after   integer not null,
  reason      text not null,
  actor       uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create index if not exists sm_product_idx on stock_movements(product_id, created_at desc);

-- ---------- derived stock view ----------
create or replace view product_stock
with (security_invoker = on) as
select
  p.*,
  coalesce(a.reserved, 0)                                        as reserved_qty,
  coalesce(d.pending, 0)                                         as pending_qty,
  p.total_qty - coalesce(a.reserved,0) - coalesce(d.pending,0)   as free_qty
from products p
left join (
  select product_id, sum(qty_approved) reserved
  from reserve_requests where status = 'approved' group by product_id
) a on a.product_id = p.id
left join (
  select product_id, sum(qty_requested) pending
  from reserve_requests where status = 'pending' group by product_id
) d on d.product_id = p.id;

-- ---------- guard: never drop total below what is reserved ----------
create or replace function guard_total_qty()
returns trigger language plpgsql as $$
declare used integer;
begin
  select coalesce(sum(qty_approved),0) into used
  from reserve_requests where product_id = new.id and status = 'approved';

  if new.total_qty < used then
    raise exception 'total_qty (%) is below the % units already reserved', new.total_qty, used;
  end if;

  new.updated_at := now();

  if tg_op = 'UPDATE' and new.total_qty <> old.total_qty then
    insert into stock_movements (product_id, delta, qty_after, reason, actor)
    values (new.id, new.total_qty - old.total_qty, new.total_qty, 'manual adjustment', auth.uid());
  end if;

  return new;
end $$;

drop trigger if exists products_guard on products;
create trigger products_guard before insert or update on products
  for each row execute function guard_total_qty();

-- ---------- RPC: create a reserve request (Sllr side) ----------
create or replace function create_reserve_request(
  p_product_id uuid,
  p_qty        integer,
  p_hold_until date default null,
  p_note       text default null
) returns reserve_requests
language plpgsql security definer set search_path = public as $$
declare r reserve_requests;
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'quantity must be at least 1';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role in ('sllr','admin')) then
    raise exception 'only Sllr users can request stock';
  end if;

  insert into reserve_requests (product_id, requested_by, qty_requested, hold_until, note)
  values (p_product_id, auth.uid(), p_qty, p_hold_until, p_note)
  returning * into r;

  return r;
end $$;

-- ---------- RPC: approve (full or partial) — supplier side ----------
-- Partial approve keeps qty_requested intact and records qty_approved separately.
create or replace function approve_reserve_request(
  p_request_id uuid,
  p_qty        integer default null,
  p_note       text default null
) returns reserve_requests
language plpgsql security definer set search_path = public as $$
declare
  r      reserve_requests;
  prod   products;
  used   integer;
  avail  integer;
  grant_qty integer;
begin
  select * into r from reserve_requests where id = p_request_id for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'request is already %', r.status; end if;

  select * into prod from products where id = r.product_id for update;

  if not exists (
    select 1 from profiles
    where id = auth.uid()
      and (role = 'admin' or (role = 'supplier' and supplier_id = prod.supplier_id))
  ) then
    raise exception 'only the owning supplier can approve this request';
  end if;

  select coalesce(sum(qty_approved),0) into used
  from reserve_requests where product_id = prod.id and status = 'approved';

  avail := prod.total_qty - used;
  grant_qty := least(coalesce(p_qty, r.qty_requested), avail);

  if grant_qty <= 0 then
    raise exception 'no free stock left for this product';
  end if;

  update reserve_requests
     set status = 'approved',
         qty_approved = grant_qty,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = p_note
   where id = r.id
  returning * into r;

  return r;
end $$;

-- ---------- RPC: reject ----------
create or replace function reject_reserve_request(p_request_id uuid, p_note text default null)
returns reserve_requests
language plpgsql security definer set search_path = public as $$
declare r reserve_requests; prod products;
begin
  select * into r from reserve_requests where id = p_request_id for update;
  if r.id is null then raise exception 'request not found'; end if;
  if r.status <> 'pending' then raise exception 'request is already %', r.status; end if;

  select * into prod from products where id = r.product_id;

  if not exists (
    select 1 from profiles where id = auth.uid()
      and (role = 'admin' or (role = 'supplier' and supplier_id = prod.supplier_id))
  ) then
    raise exception 'only the owning supplier can reject this request';
  end if;

  update reserve_requests
     set status='rejected', qty_approved=0, decided_by=auth.uid(), decided_at=now(), decision_note=p_note
   where id = r.id returning * into r;
  return r;
end $$;

-- ---------- RPC: consume reserved stock (when Sllr actually pulls it) ----------
create or replace function consume_reserve_request(p_request_id uuid)
returns reserve_requests
language plpgsql security definer set search_path = public as $$
declare r reserve_requests;
begin
  select * into r from reserve_requests where id = p_request_id for update;
  if r.status <> 'approved' then raise exception 'only approved requests can be consumed'; end if;

  update products set total_qty = total_qty - r.qty_approved where id = r.product_id;
  insert into stock_movements (product_id, delta, qty_after, reason, actor)
  select r.product_id, -r.qty_approved, total_qty, 'consumed by Sllr', auth.uid()
  from products where id = r.product_id;

  update reserve_requests set status = 'consumed' where id = r.id returning * into r;
  return r;
end $$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table suppliers        enable row level security;
alter table profiles         enable row level security;
alter table products         enable row level security;
alter table reserve_requests enable row level security;
alter table stock_movements  enable row level security;

create or replace function my_role() returns app_role
language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function my_supplier() returns uuid
language sql stable security definer set search_path = public as
$$ select supplier_id from profiles where id = auth.uid() $$;

-- profiles
drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles
  for select using (id = auth.uid() or my_role() = 'admin');

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- suppliers: everyone signed in can read, admin writes
drop policy if exists suppliers_read on suppliers;
create policy suppliers_read on suppliers for select using (auth.uid() is not null);

drop policy if exists suppliers_write on suppliers;
create policy suppliers_write on suppliers for all
  using (my_role() = 'admin') with check (my_role() = 'admin');

-- products: Sllr reads all, supplier reads + writes only its own
drop policy if exists products_read on products;
create policy products_read on products for select
  using (my_role() in ('sllr','admin') or supplier_id = my_supplier());

drop policy if exists products_write on products;
create policy products_write on products for all
  using (my_role() = 'admin' or supplier_id = my_supplier())
  with check (my_role() = 'admin' or supplier_id = my_supplier());

-- reserve requests: Sllr sees its own, supplier sees requests on its products
drop policy if exists rr_read on reserve_requests;
create policy rr_read on reserve_requests for select
  using (
    my_role() = 'admin'
    or requested_by = auth.uid()
    or exists (select 1 from products p where p.id = product_id and p.supplier_id = my_supplier())
  );

-- writes go through the RPCs above, not direct inserts
drop policy if exists rr_cancel_own on reserve_requests;
create policy rr_cancel_own on reserve_requests for update
  using (requested_by = auth.uid() and status = 'pending')
  with check (status = 'cancelled');

-- stock movements: read only, scoped like products
drop policy if exists sm_read on stock_movements;
create policy sm_read on stock_movements for select
  using (
    my_role() in ('sllr','admin')
    or exists (select 1 from products p where p.id = product_id and p.supplier_id = my_supplier())
  );

-- ============================================================
-- Storage bucket for product images
-- ============================================================
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists product_images_read on storage.objects;
create policy product_images_read on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_write on storage.objects;
create policy product_images_write on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.uid() is not null);

-- ============================================================
-- Seed: one supplier so you can start
-- ============================================================
insert into suppliers (name, contact)
values ('Al-Waseet Trading', 'ops@alwaseet.example')
on conflict do nothing;
