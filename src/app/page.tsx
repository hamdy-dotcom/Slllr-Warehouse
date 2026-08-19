import { redirect } from "next/navigation";

import { HOME } from "@/lib/routes";

/** Middleware handles this first; this is the belt to its braces. */
export default function RootPage() {
  redirect(HOME);
}
