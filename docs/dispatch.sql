-- ============================================================
-- Dispatch rename + two outstanding fixes.
--
-- NOT YET APPLIED. The app does not depend on any of this — the dispatch
-- rename is done in the UI and the alias below is the database-side
-- equivalent, offered because you asked for a view rather than a column
-- rename. Sections 2 and 3 are the two bugs found while building; the app
-- works around both, and the workarounds can come out once these run.
-- ============================================================


-- ---------- 1. dispatch alias, no columns renamed ----------
-- reserve_requests.qty_released keeps its name. This exposes it as
-- qty_dispatched alongside the outstanding figure the UI works in, so
-- anything reading the database sees the same words as the screens.
create or replace view reserve_request_dispatch as
select
  r.id,
  r.product_id,
  r.requested_by,
  r.qty_requested,
  r.qty_approved,
  r.qty_released                                                   as qty_dispatched,
  coalesce(r.qty_approved, 0) - coalesce(r.qty_released, 0)        as qty_outstanding,
  r.status,
  r.hold_until,
  r.note,
  r.decided_by,
  r.decided_at,
  r.decision_note,
  r.unit_cost,
  r.created_at
from reserve_requests r;

comment on view reserve_request_dispatch is
  'reserve_requests with qty_released exposed as qty_dispatched, plus qty_outstanding.';

-- The movement kind keeps the value release_sllr; only its label changes.
-- If you would rather the database agreed, this is the safe form — it adds a
-- value without touching the existing one, and nothing writes it yet:
--   alter type movement_kind add value if not exists 'dispatch_sllr';


-- ---------- 2. record_settlements commits what it refuses ----------
-- Reproduced from a clean state, one row, nothing else running:
--   in_progress = 19, settlements = 0
--   record_settlements('[{"sku":"SKU-1002","kind":"delivered","qty":999}]')
--   -> [{"ok": false, "message": "Only 19 units are in progress for this SKU"}]
--   in_progress = 0, settlements = 2   (5 + 14 allocated and committed)
--
-- It allocates FIFO and commits before deciding the row asked for too much.
-- The row is reported as refused, so nothing downstream knows 19 units were
-- just settled. The function needs to establish the available quantity and
-- bail out BEFORE it starts allocating, e.g. at the top of the per-row loop:
--
--   select coalesce(sum(abs(m.delta) - m.qty_settled), 0)
--     into v_available
--     from stock_movements m
--    where m.product_id = v_product_id
--      and m.kind = 'release_sllr'
--      and m.qty_settled < abs(m.delta);
--
--   if v_qty > v_available then
--     -- record the failure and CONTINUE to the next row, having written
--     -- nothing for this one
--     continue;
--   end if;
--
-- Until then the app checks every row against in_progress_qty and never lets
-- an over-delivery reach the function. See recordDaily in
-- src/app/(app)/daily/actions.ts.


-- ---------- 3. guard_total_qty breaks every direct quantity update ----------
-- Any direct update of products.total_qty now fails with:
--   column "direction" is of type movement_direction but expression is of
--   type text
--
-- The trigger's audit insert passes direction as a text literal. That takes
-- bulk_update_stock with it, and with it the inline quantity editor, the
-- quantity field in the product dialog, and the inventory bulk CSV.
-- record_stock_movements is unaffected.
--
-- The fix is a cast in the trigger's insert:
--   insert into stock_movements
--     (product_id, delta, qty_after, reason, actor, direction, kind)
--   values
--     (new.id,
--      new.total_qty - old.total_qty,
--      new.total_qty,
--      'manual adjustment',
--      auth.uid(),
--      case when new.total_qty > old.total_qty then 'in' else 'out' end::movement_direction,
--      'correction'::movement_kind);
