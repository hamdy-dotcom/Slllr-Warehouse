# Sllr warehouse

A shared shelf between Sllr and its suppliers. Sllr browses the catalog and
asks to reserve stock; the supplier approves in full, approves part, or
rejects. One codebase, two experiences, decided by `profiles.role`.

Next.js 15 App Router · TypeScript · Tailwind CSS v4 · Supabase · Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

### Environment variables

| Variable | Where to find it | Used by |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project settings → API | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project settings → API | browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project settings → API | server only — image uploads |
| `SUPABASE_PROJECT_ID` | the project ref in your dashboard URL | `npm run types` |

`.env.local` is gitignored. The service role key bypasses row level security,
so it must never reach the browser — it is read only inside server actions.

### Database

The schema in `docs/schema.sql` is already live. Do not re-run it or write
migrations against it. Regenerate the types after any schema change:

```bash
npm run types
```

Two things the schema file does not cover:

```sql
-- 1. Required for the live-updating dashboard. Without it the app works, it
-- just does not refresh on its own when a supplier approves.
alter publication supabase_realtime add table reserve_requests;

-- 2. Optional, but worth knowing about. A direct
--    "update products set total_qty = ..." fails for a supplier with
--    "new row violates row-level security policy for table stock_movements":
--    the products_guard trigger writes the audit row, stock_movements has RLS
--    on with a select policy only, and the trigger is not security definer.
--    Either of these fixes it; without them, every quantity change must go
--    through the security-definer bulk_update_stock RPC, which is what the
--    app does today.
alter function guard_total_qty() security definer;
-- or
create policy sm_insert on stock_movements for insert with check (true);
```

Accounts are provisioned in Supabase, not in the app — there is no sign-up
screen. After creating a user in Authentication → Users, set their role:

```sql
-- A Sllr user
update profiles set role = 'sllr', full_name = 'Name', supplier_id = null
where id = '<auth user id>';

-- A supplier user, tied to the organisation whose shelf they manage
update profiles set role = 'supplier', full_name = 'Name',
       supplier_id = (select id from suppliers where name = 'Al-Waseet Trading')
where id = '<auth user id>';
```

## How it works

### Roles and routing

`src/middleware.ts` refreshes the Supabase session on every page request,
reads `profiles.role`, and routes on it. A supplier who opens `/catalog` lands
on `/inventory`; a Sllr user who opens `/approvals` lands on `/catalog`.
Signed-out visitors go to `/login` with a `next` parameter, which is
restricted to same-origin paths.

| Route | sllr | supplier |
|---|---|---|
| `/dashboard` | ✓ | ✓ |
| `/catalog` | ✓ | → `/inventory` |
| `/requests` | ✓ | → `/approvals` |
| `/inventory` | → `/catalog` | ✓ |
| `/approvals` | → `/catalog` | ✓ |
| `/warehouse` | ✓ | ✓ |

### The rules that matter

- **Reserved is never stored.** It is always
  `sum(qty_approved) where status = 'approved'`, read from the `product_stock`
  view. Nothing in the app writes it.
- **Free stock is `total − reserved − pending`** and is allowed to go negative.
  Negative free renders in orange, everywhere it appears.
- **Every write to `reserve_requests` goes through the RPCs**
  (`create_reserve_request`, `approve_reserve_request`,
  `reject_reserve_request`, `consume_reserve_request`). The single exception is
  cancelling your own pending request, which the schema handles with the
  `rr_cancel_own` RLS policy instead of a function.
- **Partial approve keeps the audit trail.** `approve_reserve_request(id, qty)`
  sets `qty_approved` and leaves `qty_requested` untouched, so both numbers
  stay on screen.
- **Warehouse codes are `L03-R02-B07`** — line 03, rack 02, bin 07. The layout
  page derives all 8 × 14 bins from them; nothing about the layout is stored.

### Bulk stock update

The inventory page takes a pasted or uploaded CSV of `sku,total_qty` with an
optional `warehouse_code`, previews the diff against what is on the shelf, then
commits through `bulk_update_stock(p_rows jsonb)`. That RPC reports per row
rather than failing the batch, so one bad SKU does not cost the others; the
result table shows each row's outcome and a failed-row count. "Download CSV
template" exports the supplier's current SKUs and quantities, so the round trip
works without hand-typing a header.

Every single-row quantity change — the inline box on a row, and the quantity
field in the edit dialog — goes through the same RPC, for the reason in the
Database section above.

### Layout toggle

The catalog and the inventory each offer a grid and a rows view. Both carry the
same facts, so switching changes the shape rather than the information. The
choice is stored per route in a `sllr-view-*` cookie written by a server action,
so the server renders the right view on the first paint. The catalog opens as a
grid, the inventory as rows.

### Shape of the code

```
src/
  app/
    (app)/            screens behind the auth guard, sharing the shell and nav
    login/            sign-in only
  components/ui/      the primitives from docs/DESIGN.md
  lib/
    data/             server-only reads (marked with "server-only")
    actions/          server actions that write through the RPCs
    supabase/         browser, server, and service-role clients
    shelf.ts          pure search, filter, and roll-up — safe on the client
    warehouse.ts      the 8 × 14 grid, derived from warehouse codes
```

Reads are server components, writes are server actions. Search and filter live
in the URL so both stay server-rendered and shareable.

Design tokens are declared once in the `@theme` block of
`src/app/globals.css`, named exactly as in `docs/DESIGN.md`. Components use
those token names — no raw hex values.

### Images

Product images are scaled to 800px wide on a canvas in the browser, then sent
to a server action that stores them at
`product-images/{supplier_id}/{product_id}.jpg` and writes the public URL onto
the product. Products without an image fall back to a neutral tint tile.

The upload runs with the service role deliberately: the bucket policy grants
`insert` but not `update`, so replacing an image would fail under RLS.
Ownership is checked first using the caller's own RLS-scoped client, so the
elevated key never widens what a supplier can reach. Because the storage path
never changes, the stored URL carries a `?v=` stamp to beat the CDN cache.

Remote image hosts are allowlisted in `next.config.ts`.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run start` | serve the production build |
| `npm run lint` | ESLint |
| `npm run types` | regenerate `src/lib/database.types.ts` from Supabase |

Stop the dev server before running `npm run build` — both write to `.next`, and
a production build under a running dev server leaves it serving stale chunks.

## Deploying to Vercel

1. Push the repository to GitHub, GitLab, or Bitbucket.
2. In Vercel, **Add New → Project** and import it. The framework preset is
   detected as Next.js; leave the build command and output directory alone.
3. Under **Settings → Environment Variables**, add all four variables from
   the table above for Production, Preview, and Development.
   `SUPABASE_SERVICE_ROLE_KEY` must not be prefixed with `NEXT_PUBLIC_`.
4. Deploy.
5. In Supabase → Authentication → URL Configuration, add the deployment URL
   (and `https://*.vercel.app` for previews) to the redirect allow list.

Every screen reads per-request cookies, so the app is server-rendered on
demand rather than statically prerendered. No extra Vercel configuration is
needed for that.
