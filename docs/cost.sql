-- ============================================================
-- Product cost — run once in the Supabase SQL editor.
--
-- Adds a unit cost to the shelf and snapshots it onto every reserve request,
-- so the value Sllr holds in custody is the value it was agreed at rather
-- than whatever the cost happens to be today.
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================

-- ---------- 1. unit cost on the shelf ----------
alter table products
  add column if not exists unit_cost numeric(12, 2);

do $$ begin
  alter table products
    add constraint products_unit_cost_non_negative
    check (unit_cost is null or unit_cost >= 0);
exception when duplicate_object then null; end $$;

comment on column products.unit_cost is
  'Cost of one unit, in SAR. Null means the supplier has not priced it yet.';

-- ---------- 2. cost snapshot on the request ----------
-- Captured when the request is created. A later cost edit does not rewrite
-- what an approved request was agreed at, the same way a partial approve
-- leaves qty_requested alone.
alter table reserve_requests
  add column if not exists unit_cost numeric(12, 2);

do $$ begin
  alter table reserve_requests
    add constraint reserve_requests_unit_cost_non_negative
    check (unit_cost is null or unit_cost >= 0);
exception when duplicate_object then null; end $$;

comment on column reserve_requests.unit_cost is
  'products.unit_cost as it stood when this request was created, in SAR.';

-- ---------- 3. expose the cost through the stock view ----------
-- The original view is `select p.*`, which Postgres expanded and stored when
-- it was created — it will not pick up a new column on its own. The columns
-- are listed out here with unit_cost appended last, because CREATE OR REPLACE
-- may add columns at the end but may not reorder or rename the existing ones.
create or replace view product_stock
with (security_invoker = on) as
select
  p.id,
  p.supplier_id,
  p.name,
  p.sku,
  p.warehouse_code,
  p.image_url,
  p.total_qty,
  p.is_active,
  p.created_at,
  p.updated_at,
  coalesce(a.reserved, 0)                                       as reserved_qty,
  coalesce(d.pending, 0)                                        as pending_qty,
  p.total_qty - coalesce(a.reserved, 0) - coalesce(d.pending, 0) as free_qty,
  p.unit_cost
from products p
left join (
  select product_id, sum(qty_approved) reserved
  from reserve_requests where status = 'approved' group by product_id
) a on a.product_id = p.id
left join (
  select product_id, sum(qty_requested) pending
  from reserve_requests where status = 'pending' group by product_id
) d on d.product_id = p.id;

-- ---------- 4. capture the cost when a request is created ----------
-- Same body as docs/schema.sql, with the cost read off the product and
-- stored on the row.
create or replace function create_reserve_request(
  p_product_id uuid,
  p_qty        integer,
  p_hold_until date default null,
  p_note       text default null
) returns reserve_requests
language plpgsql security definer set search_path = public as $$
declare
  r    reserve_requests;
  cost numeric(12, 2);
begin
  if p_qty is null or p_qty < 1 then
    raise exception 'quantity must be at least 1';
  end if;

  if not exists (select 1 from profiles where id = auth.uid() and role in ('sllr','admin')) then
    raise exception 'only Sllr users can request stock';
  end if;

  select unit_cost into cost from products where id = p_product_id;

  insert into reserve_requests
    (product_id, requested_by, qty_requested, hold_until, note, unit_cost)
  values
    (p_product_id, auth.uid(), p_qty, p_hold_until, p_note, cost)
  returning * into r;

  return r;
end $$;

-- ---------- 5. optional: backfill the requests already on file ----------
-- The 135 existing requests predate the snapshot, so their unit_cost is null
-- and they render with no value. Once costs are set, this stamps them with
-- today's cost. Skip it if you would rather those rows stay blank than carry
-- a price they were not actually agreed at.
--
-- update reserve_requests r
--    set unit_cost = p.unit_cost
--   from products p
--  where p.id = r.product_id
--    and r.unit_cost is null
--    and p.unit_cost is not null;
