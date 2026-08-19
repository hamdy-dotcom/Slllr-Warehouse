"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  isToggleRoute,
  isViewMode,
  viewCookieName,
  type ToggleRoute,
  type ViewMode,
} from "@/lib/view-mode";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Stores the view choice for one route. A cookie rather than localStorage so
 * the server renders the right view on the first paint, with no flash.
 */
export async function setViewMode(route: string, mode: string) {
  if (!isToggleRoute(route) || !isViewMode(mode)) return;

  const store = await cookies();
  store.set(viewCookieName(route as ToggleRoute), mode as ViewMode, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });

  revalidatePath(route);
}
