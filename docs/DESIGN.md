# DESIGN.md — Sllr Warehouse

Visual source of truth. The working reference is `sllr-warehouse.html` in this folder — open it in a browser before writing any UI. This file is the extracted token set.

## Palette

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F2EEE9` | page background |
| `shell` | `#FAF6F1 → #F3EEE8` | outer container, subtle vertical fade |
| `card` | `#FFFFFF` | all raised cards |
| `card-soft` | `#FBF8F5` | secondary / nested cards |
| `tint` | `#F7EFE9` | image tiles, small round buttons |
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

Sentence case everywhere. No ALL CAPS except table headers.

## Shape and spacing

- Shell radius `30px`, card radius `22px`, image tile `16px`, button `13px`, nav pill `14px`, small pill `9px`
- Card padding `18px 20px`. Grid gap `14px`. Shell padding `20px 22px 26px`
- Only shadow allowed: `0 1px 3px #0000000d` on the active nav pill. No card shadows, no gradients on cards.

## Components

**KPI card** — white card, absolute round arrow button top-right (28px, tint background, `↗`), 34px orange rounded icon tile, 12.5px label, 26px value with a 13px muted unit, an orange sparkline (34px tall, 2.4px stroke, round caps), and a status pill at the bottom.

**Nav** — centered row of pills. Inactive is transparent with `ink-2` text; active is white, `ink` text, weight 500, with the hairline shadow.

**Product card** — 126px tint image tile with the warehouse code as a white chip bottom-left, then name, SKU in monospace, a stacked progress bar (orange = reserved, amber = pending, `#F0ECE6` = free), a Reserved/Free row, and a full-width orange button.

**Stock bar** — 7px tall, radius 5px, segments in the order orange → amber → track.

**Bin grid** — 8 line blocks, each 2 columns × 14 bins. Bin is 19px tall, radius 6px, 9.5px numeral. Orange when free ≤ 0, amber when free ≤ 25% of total, `bin-empty` otherwise. Occupied bins scale to 1.18 on hover and take a 2px `ink` outline when selected.

**Tags** — 11px, radius 9px, padding 4px 10px. pending = amber-soft, approved = green-soft, rejected = `#FBE9E7` / `#B8431E`, consumed = `#EFEBE5` / `ink-2`.

**Modal** — white, radius 26px, 24px padding, max-width 430px, over `#1D1B18` at 60%. Inputs are `card-soft` with a `line` border that turns orange and white on focus.

**Toast** — `ink` background, white text, radius 15px, bottom center, 2.2s.

## Copy rules

Sentence case, active voice, no exclamation marks. Buttons name the action: "Reserve stock", "Send request", "Approve 340". Errors say what to do: "Enter a number of at least 450." Empty states invite: "Nothing waiting. Approved requests show up in the inventory table."
