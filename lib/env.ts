// Server-side environment access helpers.
// Per .ai/rules/coding-standards.md, only this module (and direct client
// factories) read process.env; everything else imports from here.

function requireValue(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** First non-empty value among the given names, else throw naming them all. */
function firstValue(names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(
    `Missing required environment variable: set one of ${names.join(", ")}`,
  );
}

/** Tubig API base URL. No trailing slash. */
export function getTubigBaseUrl(): string {
  const raw = process.env.TUBIG_API_BASE_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : "https://tubig-api.rjhon.net";
}

/** Max upstream requests per minute the sync may spend (upstream allows 5). */
export function getTubigRateLimitPerMinute(): number {
  const raw = process.env.TUBIG_API_RATE_LIMIT_PER_MINUTE;
  if (raw === undefined || raw === "") return 5;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(
      "TUBIG_API_RATE_LIMIT_PER_MINUTE must be a positive integer",
    );
  }
  return parsed;
}

export function getSupabaseUrl(): string {
  return requireValue("NEXT_PUBLIC_SUPABASE_URL");
}

/**
 * Publishable (anon) key for public, RLS-constrained reads. All reads are
 * server-side (RSC), so no NEXT_PUBLIC_ exposure is needed; the names follow
 * the Supabase dashboard's key labels, oldest last as a fallback.
 */
export function getSupabasePublishableKey(): string {
  return firstValue([
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ]);
}

/** Server-only. Bypasses RLS; never expose to the client. */
export function getSupabaseSecretKey(): string {
  return requireValue("SUPABASE_SECRET_KEY");
}

/** Shared secret for the cron endpoint. Undefined means the endpoint fails closed. */
export function getCronSecret(): string | undefined {
  const raw = process.env.CRON_SECRET?.trim();
  return raw ? raw : undefined;
}
