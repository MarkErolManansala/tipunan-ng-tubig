import { createHash, timingSafeEqual } from "node:crypto";
import {
  getCronSecret,
  getTubigBaseUrl,
  getTubigRateLimitPerMinute,
} from "@/lib/env";
import { createSecretSupabaseClient } from "@/lib/supabase/server";
import { createTubigClient } from "@/lib/tubig/client";
import { createTubigTransport } from "@/lib/tubig/http";
import {
  createDamsRepository,
  createSyncRunsRepository,
  syncDams,
} from "@/features/dams";

/**
 * Vercel Cron endpoint: runs the routine dam synchronization.
 * Authenticated with `Authorization: Bearer <CRON_SECRET>` (set CRON_SECRET in
 * the deployment environment; Vercel sends this header to scheduled crons).
 * Fails closed when CRON_SECRET is not configured.
 */
function isAuthorized(request: Request): boolean {
  const secret = getCronSecret();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const separator = header.indexOf(" ");
  if (separator === -1) return false;
  const scheme = header.slice(0, separator).toLowerCase();
  const token = header.slice(separator + 1);
  if (scheme !== "bearer" || token.length === 0) return false;

  // Hash both sides so comparison is timing-safe regardless of length.
  const provided = createHash("sha256").update(token, "utf8").digest();
  const expected = createHash("sha256").update(secret, "utf8").digest();
  return timingSafeEqual(provided, expected);
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ status: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSecretSupabaseClient();
    const outcome = await syncDams({
      dams: createDamsRepository(supabase),
      syncRuns: createSyncRunsRepository(supabase),
      tubig: createTubigClient(
        createTubigTransport({
          baseUrl: getTubigBaseUrl(),
          rateLimitPerMinute: getTubigRateLimitPerMinute(),
        }),
      ),
    });

    if (!outcome.ok) {
      // Internal error details are not returned to the client (security rules).
      console.error(`Dam sync failed (${outcome.code}): ${outcome.message}`);
      const status = outcome.code === "already-running" ? 409 : 500;
      return Response.json(
        { status: "error", code: outcome.code },
        { status },
      );
    }
    return Response.json({
      status: "ok",
      runId: outcome.runId,
      pagesFetched: outcome.pagesFetched,
      itemsUpserted: outcome.itemsUpserted,
    });
  } catch (error) {
    console.error(
      `Dam sync crashed: ${error instanceof Error ? error.message : String(error)}`,
    );
    return Response.json({ status: "error", code: "sync-crashed" }, { status: 500 });
  }
}
