/**
 * Movement vocabulary. Pure, so both the server pages and the client dialogs
 * can import it.
 *
 * The kinds come from the `movement_kind` enum; which ones belong to which
 * direction is a product decision, not a database one.
 */
import type { Database } from "@/lib/database.types";

export type Direction = Database["public"]["Enums"]["movement_direction"];
export type MovementKind = Database["public"]["Enums"]["movement_kind"];

export const DIRECTIONS: Direction[] = ["in", "out"];

/**
 * Every kind the enum carries. Labels live in the message catalogues under
 * `movements.kind_<kind>` — the enum value stays `release_sllr` whatever a
 * screen calls it, so nothing in the database has to move for a rename or a
 * translation.
 */
export const MOVEMENT_KINDS: MovementKind[] = [
  "purchase",
  "return",
  "correction",
  "release_sllr",
  "sale_other",
  "damage",
];

/**
 * Which kinds a direction offers when recording a movement by hand.
 *
 * `release_sllr` is deliberately absent: a dispatch has to be allocated
 * against approved requests, and that now happens in one place, on the daily
 * update screen.
 */
export const KINDS_BY_DIRECTION: Record<Direction, MovementKind[]> = {
  in: ["purchase", "return", "correction"],
  out: ["sale_other", "damage"],
};

/**
 * Every kind that can appear in the ledger, for filtering.
 *
 * Wider than what can be recorded by hand: a dispatch is written by the daily
 * update, and rows you cannot create are still rows you need to find.
 */
export const FILTERABLE_KINDS: Record<Direction, MovementKind[]> = {
  in: ["purchase", "return", "correction"],
  out: ["release_sllr", "sale_other", "damage"],
};

/** The kind a dispatch is stored as. Written only by the daily screen. */
export const DISPATCH_KIND: MovementKind = "release_sllr";

export function isDirection(value: string | undefined): value is Direction {
  return value === "in" || value === "out";
}

export function isMovementKind(
  value: string | undefined,
): value is MovementKind {
  return value !== undefined && MOVEMENT_KINDS.includes(value as MovementKind);
}

/** Whether a kind is valid for a direction. */
export function kindFits(direction: Direction, kind: MovementKind): boolean {
  return KINDS_BY_DIRECTION[direction].includes(kind);
}

/**
 * `+120` or `−45`, the way the ledger shows a delta. Zero carries no sign —
 * "−0" reads as a loss of nothing rather than as nothing having happened.
 */
export function signedQty(direction: Direction, qty: number): string {
  const size = Math.abs(qty);
  const text = size.toLocaleString("en-US");
  if (size === 0) return text;
  return direction === "in" ? `+${text}` : `−${text}`;
}
