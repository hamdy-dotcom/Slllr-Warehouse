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

export const DIRECTION_LABELS: Record<Direction, string> = {
  in: "Inbound",
  out: "Outbound",
};

export const KIND_LABELS: Record<MovementKind, string> = {
  purchase: "Purchase",
  return: "Return",
  correction: "Correction",
  release_sllr: "Release to Sllr",
  sale_other: "Sold elsewhere",
  damage: "Damage",
};

/** Which kinds a direction offers. */
export const KINDS_BY_DIRECTION: Record<Direction, MovementKind[]> = {
  in: ["purchase", "return", "correction"],
  out: ["release_sllr", "sale_other", "damage"],
};

/** The one kind that must be tied to an approved reserve request. */
export const RELEASE_KIND: MovementKind = "release_sllr";

export function isDirection(value: string | undefined): value is Direction {
  return value === "in" || value === "out";
}

export function isMovementKind(
  value: string | undefined,
): value is MovementKind {
  return value !== undefined && value in KIND_LABELS;
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

/**
 * What a release does to the request behind it — the sentence the supplier
 * sees before confirming, because the outcome differs by a single unit.
 */
export function releaseOutcome(
  qty: number,
  approvedQty: number,
): { valid: boolean; message: string } {
  if (!Number.isInteger(qty) || qty < 1) {
    return { valid: false, message: "Enter a quantity of at least 1." };
  }

  if (qty > approvedQty) {
    return {
      valid: false,
      message: `That request only has ${approvedQty.toLocaleString("en-US")} units approved.`,
    };
  }

  if (qty === approvedQty) {
    return {
      valid: true,
      message: `Releases the whole request. It is marked consumed and stops counting towards Reserved for Sllr.`,
    };
  }

  const left = approvedQty - qty;
  return {
    valid: true,
    message: `Partial release. The request drops to ${left.toLocaleString("en-US")} units and stays reserved for Sllr.`,
  };
}
