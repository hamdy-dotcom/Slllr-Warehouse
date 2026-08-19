/**
 * Grid or rows, remembered per route in a cookie so the choice survives
 * navigation and is known before the page renders on the server.
 */
export type ViewMode = "grid" | "rows";

/** Routes that offer the toggle, with the view each one opens in. */
export const DEFAULT_VIEW = {
  "/catalog": "grid",
  "/inventory": "rows",
} as const satisfies Record<string, ViewMode>;

export type ToggleRoute = keyof typeof DEFAULT_VIEW;

export function isViewMode(value: string | undefined): value is ViewMode {
  return value === "grid" || value === "rows";
}

export function isToggleRoute(value: string): value is ToggleRoute {
  return value in DEFAULT_VIEW;
}

/** `/catalog` → `sllr-view-catalog`. */
export function viewCookieName(route: ToggleRoute): string {
  return `sllr-view-${route.replace(/^\//, "")}`;
}
