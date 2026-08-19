import "server-only";

import { cookies } from "next/headers";

import {
  DEFAULT_VIEW,
  isViewMode,
  viewCookieName,
  type ToggleRoute,
  type ViewMode,
} from "@/lib/view-mode";

/** The stored view for a route, or that route's default. */
export async function readViewMode(route: ToggleRoute): Promise<ViewMode> {
  const store = await cookies();
  const stored = store.get(viewCookieName(route))?.value;
  return isViewMode(stored) ? stored : DEFAULT_VIEW[route];
}
