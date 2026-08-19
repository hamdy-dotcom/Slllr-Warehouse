# CLAUDE.md — Sllr × Supplier warehouse

Build a Next.js 15 App Router app called `sllr-warehouse`. Stack: TypeScript, Tailwind CSS v4, Supabase (auth + Postgres + storage), deployed on Vercel.

## Read these first

- `docs/DESIGN.md` — the complete design token set. This is binding.
- `docs/sllr-warehouse.html` — a working single-file prototype of the whole system. Open and read it; it shows every screen, every interaction, and the exact visual language to reproduce.
- `docs/schema.sql` — the database that is already live in Supabase.

## Database

The schema in `docs/schema.sql` has already been run. Do **not** write migrations or recreate tables. Read it to understand: `suppliers`, `profiles`, `products`, `reserve_requests`, `stock_movements`, the view `product_stock`, and the RPCs `create_reserve_request`, `approve_reserve_request`, `reject_reserve_request`, `consume_reserve_request`.

Generate types once the env vars are in place:

```bash
npx supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > src/lib/database.types.ts
```

## Business rules — do not deviate

1. `Reserved for Sllr` is never stored or edited. It is always `sum(qty_approved) where status = 'approved'`, read from the `product_stock` view.
2. Free stock = `total_qty - reserved_qty - pending_qty`. Render it in orange when negative.
3. All writes to `reserve_requests` go through the RPCs. Never insert or update that table directly from the client.
4. Partial approve calls `approve_reserve_request(id, qty)` — it sets `qty_approved` and leaves `qty_requested` untouched. Show both in the UI so the audit trail is visible.
5. Every product row shows image, name, SKU, and warehouse code. Format is `L03-R02-B07` = line 03, rack 02, bin 07.

## Roles

Read `profiles.role` after login. Two experiences from one codebase.

**sllr** — Dashboard · Catalog (browse supplier products, submit reserve requests) · My requests (status list, cancel pending) · Warehouse layout

**supplier** — Dashboard · Inventory (own products, add/edit, update total_qty, upload image) · Approvals (approve full, approve partial, reject) · Warehouse layout

Guard routes in middleware. A supplier hitting `/catalog` redirects to `/inventory`; a Sllr user hitting `/approvals` redirects to `/catalog`.

## Warehouse layout page

Render 8 lines × 14 bins derived from `warehouse_code`. Bin is orange when free ≤ 0, amber when free ≤ 25% of total, neutral otherwise. Clicking an occupied bin opens a panel with that product's name, SKU, code, and live free quantity.

## Images

Upload to the `product-images` storage bucket at path `{supplier_id}/{product_id}.{ext}`, store the public URL in `products.image_url`. Compress client-side to max 800px wide before upload. Fall back to a neutral tint tile when `image_url` is null.

## Realtime

Subscribe to `reserve_requests` changes. When the supplier approves, Sllr dashboard numbers update without a refresh.

## Conventions

- Server components for reads, server actions for writes
- No `any` types, no `@ts-ignore`
- Tailwind theme tokens named exactly as in `docs/DESIGN.md` — no arbitrary hex values in components
- Sentence case in all UI copy

## Build order

Commit after each step with a clear message.

1. Scaffold, Tailwind theme tokens, Poppins, shared primitives (Card, Kpi, Button, Tag, Modal, Toast)
2. Supabase clients (browser + server), middleware auth guard, login page, role redirect
3. `product_stock` data layer, Catalog and Inventory pages
4. Reserve request flow, Approvals with partial approve
5. Warehouse layout grid
6. Image upload, realtime subscription
7. `README.md` with env vars and Vercel deploy steps

## Env vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_ID=
```

Ask me for these values at the start of step 2. Write `.env.example`, and put `.env.local` in `.gitignore`.
