import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { HOME, canAccess, isAppRoute, redirectFor } from "@/lib/routes";
import type { AppRole } from "@/lib/types";

const LOGIN = "/login";

export async function middleware(request: NextRequest) {
  // Rebuilt by `setAll` whenever Supabase rotates the session cookies.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Always getUser() — it revalidates the token with Supabase, unlike getSession().
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user) {
    if (pathname === LOGIN) return response;

    const url = request.nextUrl.clone();
    url.pathname = LOGIN;
    url.search = "";
    // Remember where they were headed so login can send them back.
    if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
    return redirect(url, response);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: AppRole }>();

  // Signed in but no profile row yet — the trigger runs on insert, so this is
  // only reachable if the row was deleted. Send them back to a clean login.
  if (!profile) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = LOGIN;
    url.search = "?error=no-profile";
    return redirect(url, response);
  }

  if (pathname === LOGIN || pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = HOME;
    url.search = "";
    return redirect(url, response);
  }

  if (isAppRoute(pathname) && !canAccess(profile.role, pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = redirectFor(profile.role, pathname);
    url.search = "";
    return redirect(url, response);
  }

  return response;
}

/** Carries any refreshed auth cookies onto the redirect. */
function redirect(url: URL, carrying: NextResponse) {
  const next = NextResponse.redirect(url);
  for (const cookie of carrying.cookies.getAll()) {
    next.cookies.set(cookie);
  }
  return next;
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets — the session has to
     * be refreshed on real page requests, not on image fetches.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
