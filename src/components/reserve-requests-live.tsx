"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

/**
 * Keeps every screen in step with `reserve_requests`. When the supplier
 * approves, the Sllr dashboard numbers move without a refresh.
 *
 * Nothing is read off the payload — a change means the server components need
 * to run again, and they hold the only copy of the derived stock numbers.
 *
 * This needs the table in the realtime publication:
 *   alter publication supabase_realtime add table reserve_requests;
 * Without it the app still works; it just will not live-update.
 */
export function ReserveRequestsLive() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | null = null;

    // A bulk approval can fire a burst; coalesce it into one refresh.
    const refresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 250);
    };

    const channel = supabase
      .channel("reserve-requests-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reserve_requests" },
        refresh,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
