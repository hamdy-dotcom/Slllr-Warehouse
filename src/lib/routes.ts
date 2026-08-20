import type { AppRole } from "@/lib/types";

/** `key` names an entry in the `nav` messages, never the copy itself. */
export type NavItem = { href: string; key: string };

/** One codebase, two experiences. Admin borrows the supplier nav plus catalog. */
export const NAV: Record<AppRole, NavItem[]> = {
  sllr: [
    { href: "/dashboard", key: "dashboard" },
    { href: "/catalog", key: "catalog" },
    { href: "/requests", key: "requests" },
    { href: "/wallet", key: "wallet" },
    { href: "/daily", key: "daily" },
  ],
  supplier: [
    { href: "/dashboard", key: "dashboard" },
    { href: "/inventory", key: "inventory" },
    { href: "/movements", key: "movements" },
    { href: "/wallet", key: "wallet" },
    { href: "/approvals", key: "approvals" },
  ],
  admin: [
    { href: "/dashboard", key: "dashboard" },
    { href: "/catalog", key: "catalog" },
    { href: "/daily", key: "daily" },
    { href: "/inventory", key: "inventory" },
    { href: "/movements", key: "movements" },
    { href: "/wallet", key: "wallet" },
    { href: "/approvals", key: "approvals" },
  ],
};

/** Which roles may open each app route. */
const ACCESS: Record<string, readonly AppRole[]> = {
  "/dashboard": ["sllr", "supplier", "admin"],
  "/catalog": ["sllr", "admin"],
  "/requests": ["sllr", "admin"],
  "/inventory": ["supplier", "admin"],
  "/movements": ["supplier", "admin"],
  "/approvals": ["supplier", "admin"],
  "/wallet": ["sllr", "supplier", "admin"],
  "/daily": ["sllr", "admin"],
};

/** Where a role lands with no route in mind. */
export const HOME = "/dashboard";

/**
 * The other role's equivalent screen, so a wrong turn lands somewhere useful
 * instead of bouncing to the dashboard.
 */
const COUNTERPART: Partial<Record<AppRole, Record<string, string>>> = {
  supplier: {
    "/catalog": "/inventory",
    "/requests": "/approvals",
    "/daily": "/wallet",
  },
  sllr: {
    "/inventory": "/catalog",
    "/movements": "/catalog",
    "/approvals": "/catalog",
  },
};

/** The `/dashboard` in `/dashboard/anything`. */
function section(pathname: string): string {
  const [, first] = pathname.split("/");
  return first ? `/${first}` : "/";
}

export function isAppRoute(pathname: string): boolean {
  return section(pathname) in ACCESS;
}

export function canAccess(role: AppRole, pathname: string): boolean {
  const allowed = ACCESS[section(pathname)];
  return allowed ? allowed.includes(role) : true;
}

export function redirectFor(role: AppRole, pathname: string): string {
  return COUNTERPART[role]?.[section(pathname)] ?? HOME;
}
