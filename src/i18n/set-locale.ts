"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, isLocale } from "./config";

const ONE_YEAR = 60 * 60 * 24 * 365;

/**
 * Stores the chosen language.
 *
 * The action only writes the cookie; the caller refreshes the router once it
 * resolves. Revalidating the layout from in here instead re-renders the whole
 * tree inside the action's own module graph, which is what the language
 * toggle sits in — and that tears the client reference for the toggle itself.
 */
export async function setLocale(next: string) {
  if (!isLocale(next)) return;

  const store = await cookies();
  store.set(LOCALE_COOKIE, next, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
    httpOnly: false,
  });
}
