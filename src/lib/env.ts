/**
 * Next.js inlines `NEXT_PUBLIC_*` at build time, so these have to be read as
 * literal property accesses — no dynamic lookup, no destructuring of
 * `process.env`.
 */
function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `${name} is missing. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const SUPABASE_URL = required(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "NEXT_PUBLIC_SUPABASE_URL",
);

export const SUPABASE_ANON_KEY = required(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
);
