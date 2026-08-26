# DESIGN.md — Sllr Warehouse

Visual source of truth. The working reference is `sllr-warehouse.html` in this folder — open it in a browser before writing any UI. This file is the extracted token set.

## Palette

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F2EEE9` | page background |
| `shell` | `#FAF6F1 → #F3EEE8` | outer container, subtle vertical fade |
| `card` | `#FFFFFF` | all raised cards |
| `card-soft` | `#FBF8F5` | secondary / nested cards |
| `tint` | `#F7EFE9` | image tiles, small round buttons, stocked warehouse bin |
| `line` | `#E8E2DA` | hairlines, input borders |
| `ink` | `#1D1B18` | primary text |
| `ink-2` | `#7C766D` | labels, secondary text |
| `ink-3` | `#A9A29A` | meta, SKU, monospace |
| `orange` | `#F0663A` | accent, reserved, primary button |
| `orange-soft` | `#FDEDE6` | orange pill background |
| `amber` | `#F5B231` | pending, low stock |
| `amber-soft` | `#FEF3DF` | amber pill background |
| `green` | `#2E9E5B` | approved, positive delta |
| `green-soft` | `#E6F4EA` | green pill background |
| `bin-empty` | `#F4F1ED` | unoccupied warehouse bin |

Orange hover: `#DD5730`. Text on orange-soft: `#B8431E`. Text on amber-soft: `#9A6B0C`.

## Type

Poppins via `next/font/google`, weights 300 / 400 / 500 / 600 only. Never 700.

Arabic has no Poppins coverage, so it gets **IBM Plex Sans Arabic** via
`next/font/google` at the same four weights. Both faces are declared on
`<html>` as CSS variables; `globals.css` swaps `--font-sans` on
`html[lang="ar"]` so the whole scale below applies unchanged in either
language. Poppins stays second in the Arabic stack on purpose: a SKU or a
warehouse code sitting inside Arabic text keeps the shape it has in English.

The Arabic face is loaded with `preload: false` — an English page never
renders a glyph from it.

| Role | Size | Weight |
|---|---|---|
| Page title | 29px | 500, letter-spacing -0.4px |
| KPI value | 26px | 500, letter-spacing -0.5px |
| Section title | 16px | 500 |
| Product name | 14px | 500 |
| Body / table | 13px | 400 |
| Label, muted | 12.5px | 400 |
| Meta (SKU, warehouse code) | 11px | 400, monospace |
| Table header | 11.5px | 400, uppercase, letter-spacing 0.4px |

Sentence case everywhere. No ALL CAPS except table headers. Arabic has no
case, so the equivalent is plain declarative phrasing — no shouting, no
decorative punctuation.

## Shape and spacing

- Shell radius `30px`, card radius `22px`, image tile `16px`, button `13px`, nav pill `14px`, small pill `9px`
- Card padding `18px 20px`. Grid gap `14px`. Shell padding `20px 22px 26px`
- Only shadow allowed: `0 1px 3px #0000000d` on the active nav pill. No card shadows, no gradients on cards.

## Components

**KPI card** — white card, absolute round arrow button top-right (28px, tint background, `↗`), 34px orange rounded icon tile, 12.5px label, 26px value with a 13px muted unit, an orange sparkline (34px tall, 2.4px stroke, round caps), and a status pill at the bottom.

**Nav** — centered row of pills. Inactive is transparent with `ink-2` text; active is white, `ink` text, weight 500, with the hairline shadow.

**Product card** — 126px tint image tile with the warehouse code as a white chip bottom-left, then name, SKU in monospace, a stacked progress bar (orange = reserved, amber = pending, `#F0ECE6` = free), a Reserved/Free row, and a full-width orange button.

**Stock bar** — 7px tall, radius 5px, segments in the order orange → amber → track.

**Bin grid** — 8 line blocks, each 2 columns × 14 bins. Bin is 19px tall, radius 6px, 9.5px numeral. Four states:

| Bin | Fill | Numeral |
|---|---|---|
| Free ≤ 0 | `orange` | white |
| Free ≤ 25% of total | `amber` | `#5B3F04` |
| Occupied and healthy | `tint` | `ink-3` |
| Holds nothing | `bin-empty` | `ink-3` |

A stocked bin has to be legible against an empty one, so the two neutrals are kept a step apart rather than sharing `bin-empty`. Occupied bins scale to 1.18 on hover and take a 2px `ink` outline when selected. The legend carries all four states in that order.

**Tags** — 11px, radius 9px, padding 4px 10px. pending = amber-soft, approved = green-soft, rejected = `#FBE9E7` / `#B8431E`, consumed = `#EFEBE5` / `ink-2`.

**Modal** — white, radius 26px, 24px padding, max-width 430px, over `#1D1B18` at 60%. Inputs are `card-soft` with a `line` border that turns orange and white on focus.

**Toast** — `ink` background, white text, radius 15px, bottom center, 2.2s.

## Copy rules

Sentence case, active voice, no exclamation marks. Buttons name the action: "Reserve stock", "Send request", "Approve 340". Errors say what to do: "Enter a number of at least 450." Empty states invite: "Nothing waiting. Approved requests show up in the inventory table."

The same rules hold in Arabic: buttons name the action ("إرسال الطلب",
"اعتماد 340"), errors say what to do ("أدخل رقمًا لا يقل عن 450."), and no
message ends in an exclamation mark.

## Words

One word, one meaning, everywhere.

**Dispatched** is the live pool: stock that has left the warehouse to
customers and is waiting to be delivered or returned. It is never the running
total of everything that has ever been dispatched — that counter exists in the
database and stays there.

**Outstanding** is approved and still on the shelf, not yet dispatched.
**Delivered** and **returned** are settled and have left the pool.
**Cancelled** was released back to the supplier; approved quantity never
shrinks to account for it.

A row about a PO adds up: approved = dispatched + delivered + returned +
outstanding + cancelled.

A progress bar over one of those rows stacks every share, cancelled included
in a muted grey, so the empty part of the track always means "still on the
shelf" and nothing else. A percentage printed next to it counts only what
left the shelf.

In Arabic the stock lifecycle uses the تسليم family and the ص-ر-ف root is
reserved for money:

| English | Arabic |
|---|---|
| dispatched (the pool) | قيد التسليم |
| awaiting dispatch | بانتظار التسليم |
| part dispatched | قيد التسليم جزئيًا |
| dispatch (the act) | إرسال / مُرسَل |
| delivered | مُسلَّم |
| returned | مُرتجع |
| outstanding | المتبقي |
| cancelled | الملغى |
| paid to the supplier | المصروف |

المصروف reads as money paid out, so it names only that. It appeared on the
same page as the dispatched pool once and has to stay off it.

## Direction

Arabic renders right to left: `<html dir="rtl" lang="ar">`, set from the
locale cookie. Everything that has a side uses a logical property — `ms-`,
`me-`, `ps-`, `pe-`, `text-start`, `text-end`, `rounded-s-`, `rounded-e-`,
`start-`, `end-` — never `left` or `right`. Two exceptions are deliberate:
the toast is centred with `left-1/2 -translate-x-1/2`, which is symmetric,
and `-translate-x-` is a physical transform that must stay paired with it.

Icons and glyphs that point somewhere mirror with the text. The KPI arrow is
`↗` reading left to right and `↖` reading right to left, and the before/after
arrow in every preview table is `→` or `←`; both come from the message
catalogue rather than being hard-coded, so they turn with the language.

Latin identifiers inside Arabic text — a SKU, `L03-R02-B07`, a reference, a
date in a CSV — carry the `latin` utility (`direction: ltr;
unicode-bidi: isolate`). Without the isolate the bidi algorithm reorders the
run against its neighbours and `L03-R02-B07` comes out backwards.

Numbers, currency, and dates stay in Latin digits in both languages. `n()`
and `money()` format against `en-US` regardless of locale, and dates use the
bare `ar` locale, which gives Arabic month names over Latin numerals —
`ar-SA` would switch to Arabic-Indic digits and is deliberately not used.
