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

The schema in `docs/schema.sql` is already live, with the cost columns in
`docs/cost-applied.sql` and the movement columns, enums, and
`record_stock_movements` RPC applied on top of it. Neither is a migration to
run — they record what is already there. Regenerate the types after any schema
change:

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
- **Cost is snapshotted onto a request.** `create_reserve_request` stamps
  `products.unit_cost` onto `reserve_requests.unit_cost`. Re-pricing a product
  changes what the shelf is worth; it must not change what an already agreed
  reservation was worth.

### Bulk stock update

The inventory page takes a pasted or uploaded CSV of `sku,total_qty` with an
optional `warehouse_code` and `unit_cost`, previews the diff against what is on
the shelf, then commits. Quantity and code go through
`bulk_update_stock(p_rows jsonb)`, which reports per row rather than failing the
batch. Cost is a plain column with no guard trigger behind it, so it is written
with a direct update alongside.

Because those are two separate writes, a row can half-succeed — a quantity
below what is reserved is refused while the new price still lands. The result
table says so per row (`Cannot go below the 1637 units already reserved · cost
updated`) rather than reporting only one half.

The cost cell has three states, because a blank cannot mean both "leave it" and
"clear it": a number sets the price, blank leaves it alone, and `-` clears it
back to not priced. "Download CSV template" exports the supplier's current
SKUs, quantities, and costs, so the round trip works without hand-typing a
header.

Every single-row quantity change — the inline box on a row, and the quantity
field in the edit dialog — goes through the same RPC, for the reason in the
Database section above.

### Cost and value

Money is SAR throughout, formatted in `src/lib/money.ts` — two decimals for a
unit price, none for a rolled-up value. Sllr sees the supplier's unit cost, not
just the totals.

Which cost a figure uses depends on what the figure means:

| Figure | Source | Why |
|---|---|---|
| Stock value, free value | `products.unit_cost` today | what the shelf is worth now |
| Reserved / in custody | the snapshot on each approved request | what it was agreed at |
| Requested, awaiting approval | the snapshot on each pending request | what it was quoted at |

`unit_cost` is nullable and "not priced yet" is a real state, so a value is
never faked as zero. Every roll-up carries how many rows it could not price and
the screen shows that as a caveat — `SAR 23,780,344 · 4 not priced` — rather
than quietly reporting a total that is missing lines.

### Movements

`/movements` is the supplier's ledger of everything that has come onto the
shelf or left it, filterable by direction, kind, date range, and free text over
product, SKU, code, and reference.

Recording goes through `record_stock_movements(p_rows jsonb)`, which answers
per row like `bulk_update_stock` and enforces the rule that matters: outbound
stock can never take a product below what is reserved for Sllr. The dialog
shows the same arithmetic before you commit —
`195 → 5 on the shelf — that is below the 19 reserved for Sllr, so this will be
refused.`

`release_sllr` is the one kind that must name an approved reserve request, and
its effect depends on the quantity, so the dialog spells that out too:

| Release | Effect |
|---|---|
| the full approved quantity | request is marked `consumed` and stops counting towards Reserved |
| less than that | `qty_approved` drops by the amount and the rest stays reserved |

`qty_requested` is never touched either way, so the audit trail survives a
release the same way it survives a partial approve.

Bulk CSV takes `sku,qty,kind,reference,note`. Direction is not a column — it
comes from which form you are in, so a file of inbound rows cannot quietly
contain an outbound one. Releases are excluded from bulk, because each one has
to name a request and a spreadsheet cannot make that choice.

### Recording stock movement

The daily update is the only place stock movement is recorded. One paste,
three kinds:

| Kind | Draws from | Effect |
|---|---|---|
| dispatched | outstanding (`qty_approved − qty_released`) | off the shelf, into in progress |
| delivered | in progress | billed |
| returned | in progress | back on the shelf, never billed |

Rows are simulated in paste order against the live pools, so a SKU dispatched
on one line and delivered on the next sees its own dispatch. Nothing is written
unless the whole paste fits — half a day landing is worse than none of it, and
`record_settlements` cannot be trusted to refuse a row without committing it
first (see `docs/dispatch.sql`).

`simulateDaily` in `src/lib/daily.ts` runs both in the browser for the preview
and on the server for the decision, so what the screen promises and what the
action allows cannot drift.

A dispatch is booked against approved requests oldest first, split across
several when one row is larger than the oldest request, because
`record_stock_movements` takes one request per movement.

**Dispatch, not release.** The UI says dispatched throughout. The database
still says `qty_released` and `release_sllr`; `docs/dispatch.sql` has a view
exposing them under the new words without renaming anything.

### Wallet and settlement

Released stock is not owed for yet. It sits **in progress** until Sllr confirms
each unit as delivered or returned, which is what `/wallet` and `/daily` do.

| Figure | Meaning |
|---|---|
| In progress | released, not yet confirmed. Not payable. |
| Delivered | confirmed taken. This is what is billed. |
| Returned | sent back to the supplier. Puts units on the shelf; never billed. |
| Balance owed | `delivered_value − paid_total` |

A settlement is allocated FIFO across that product's release lines, so it
takes its cost from the oldest unsettled release rather than from today's
product cost. `/daily` is the same thing for a whole day at once: paste
`sku,kind,qty,occurred_on,reference` and every row shows what the SKU had in
progress before and after before anything is committed.

Sllr records; a supplier sees only its own wallet, read-only. That scoping is
applied in `src/lib/data/wallet.ts` because `supplier_wallet` is **not** scoped
by the database — a supplier querying the view directly gets every row.

**Known issue in `record_settlements`.** It allocates FIFO and commits before
deciding a row asked for more than is in progress, so a row it reports as
refused has already settled everything available. Reproduced from a clean
state: `[{sku: "SKU-1002", kind: "delivered", qty: 999}]` against 19 in
progress returned `ok: false, "Only 19 units are in progress for this SKU"` and
still created two settlement rows totalling 19. Until the function rolls back,
`recordSettlements` checks every row against `in_progress_qty` first and never
lets an over-delivery reach it.

**Known issue in `guard_total_qty`.** Its audit insert passes `direction` as
text, so any direct `products.total_qty` update now fails with
`column "direction" is of type movement_direction but expression is of type
text`. That takes `bulk_update_stock` with it, and with it the inline quantity
editor, the quantity field in the product dialog, and the inventory bulk CSV.
`record_stock_movements` is unaffected.

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
