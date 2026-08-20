-- ============================================================
-- Product cost — ALREADY APPLIED to the live database.
--
-- This file records what is actually there. It is a reconstruction, verified
-- against the live schema by introspection, not a dump of the script that was
-- run — so treat the shapes and semantics as authoritative and the exact
-- wording as indicative.
--
-- Verified on the live project:
--   * products.unit_cost and reserve_requests.unit_cost exist, numeric(12,2),
--     nullable, and come back over PostgREST as JS numbers rather than strings.
--   * product_stock exposes unit_cost among the product columns, then
--     reserved_qty, pending_qty, free_qty, and stock_value last.
--   * stock_value = total_qty * unit_cost across all 100 rows, and is null
--     for the 4 products with no cost.
--   * product_stock still runs with security_invoker on: a supplier sees 60
--     rows through the view and 60 through the table, out of 100.
--   * 130 of 135 requests carry a snapshot; the 5 without are exactly the
--     requests against the 4 unpriced products.
-- ============================================================

-- ---------- unit cost on the shelf ----------
alter table products
  add column if not exists unit_cost numeric(12, 2);

-- ---------- cost snapshot on the request ----------
-- Stamped when the request is created, so a later cost edit does not rewrite
-- what an approved request was agreed at.
alter table reserve_requests
  add column if not exists unit_cost numeric(12, 2);

-- ---------- the stock view ----------
-- Dropped and recreated with an explicit column list. Column order below is
-- the live order; unit_cost sits with the product columns and stock_value is
-- last. security_invoker must stay on — without it the view runs as its owner
-- and every supplier sees the whole shelf.
drop view if exists product_stock;

create view product_stock
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
  p.unit_cost,
  coalesce(a.reserved, 0)                                        as reserved_qty,
  coalesce(d.pending, 0)                                         as pending_qty,
  p.total_qty - coalesce(a.reserved, 0) - coalesce(d.pending, 0) as free_qty,
  p.total_qty * p.unit_cost                                      as stock_value
from products p
left join (
  select product_id, sum(qty_approved) reserved
  from reserve_requests where status = 'approved' group by product_id
) a on a.product_id = p.id
left join (
  select product_id, sum(qty_requested) pending
  from reserve_requests where status = 'pending' group by product_id
) d on d.product_id = p.id;

-- ---------- capture the cost when a request is created ----------
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
