export type TubigResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: TubigError };

export type TubigError =
  | { kind: "rate-limit"; retryAfterSeconds: number | null; message: string }
  | { kind: "http"; status: number; message: string }
  | { kind: "network"; message: string }
  | { kind: "timeout"; message: string }
  | { kind: "parse"; message: string };

export type TubigTransportConfig = {
  /** Base URL without trailing slash. Defaults to the public Tubig API. */
  baseUrl?: string;
  /** Max requests per minute (upstream allows 5 per visitor). Default 5. */
  rateLimitPerMinute?: number;
  /** Per-request timeout. Default 15s. */
  timeoutMs?: number;
  /** Bounded retries for 429 / 5xx / network / timeout. Default 2. */
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  /** Injectable clock (ms since epoch) for pacing; default Date.now. */
  now?: () => number;
  /** Injectable sleep for pacing/retries; default a real timer. */
  sleep?: (ms: number) => Promise<void>;
};

export interface TubigTransport {
  readonly baseUrl: string;
  /** Fetch a JSON body from a path relative to the pinned base URL. */
  fetchJson(path: string): Promise<TubigResult<unknown>>;
}

const DEFAULT_BASE_URL = "https://tubig-api.rjhon.net";
const DEFAULT_RATE_LIMIT_PER_MINUTE = 5;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const RETRY_BACKOFF_BASE_MS = 500;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError; // fetch throws TypeError on network failure
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function parseRetryAfterSeconds(header: string | null): number | null {
  if (header === null) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * Creates the transport through which every Tubig API request flows.
 *
 - Requests are paced so no more than `rateLimitPerMinute` calls start per minute
 *   (the sync is sequential; spacing consecutive calls enforces the budget).
 - Requests carry a timeout and bounded retries.
 - `429` responses honor the `Retry-After` header before retrying.
 * Only paths on the pinned base URL can be requested — see `client.ts` for the
 * SSRF checks applied to `next` paths before they reach this transport.
 */
export function createTubigTransport(
  config: TubigTransportConfig = {},
): TubigTransport {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
  const rateLimitPerMinute =
    config.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const fetchImpl = config.fetchImpl ?? fetch;
  const now = config.now ?? (() => Date.now());
  const sleep = config.sleep ?? defaultSleep;

  const minIntervalMs = 60_000 / rateLimitPerMinute;
  let lastCallStartedAt = -Infinity;

  return {
    baseUrl,

    async fetchJson(path) {
      // Reserve the next pacing slot: wait until the previous call's slot frees up.
      for (;;) {
        const earliest = lastCallStartedAt + minIntervalMs;
        const current = now();
        if (current >= earliest) {
          lastCallStartedAt = current;
          break;
        }
        await sleep(earliest - current);
      }

      for (let attempt = 0; ; attempt += 1) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), timeoutMs);
          let response: Response;
          try {
            response = await fetchImpl(`${baseUrl}${path}`, {
              signal: controller.signal,
              headers: { accept: "application/json" },
            });
          } finally {
            clearTimeout(timer);
          }

          if (response.status === 429) {
            const retryAfterSeconds = parseRetryAfterSeconds(
              response.headers.get("retry-after"),
            );
            if (attempt >= maxRetries) {
              return {
                ok: false,
                error: {
                  kind: "rate-limit",
                  retryAfterSeconds,
                  message: `Rate limited by Tubig API after ${attempt + 1} attempts${retryAfterSeconds === null ? "" : ` (Retry-After ${retryAfterSeconds}s)`}`,
                },
              };
            }
            // Honor Retry-After; fall back to the pacing interval if absent.
            await sleep(
              Math.max((retryAfterSeconds ?? 0) * 1000, minIntervalMs),
            );
            continue;
          }

          if (response.status >= 500) {
            if (attempt < maxRetries) {
              await sleep(RETRY_BACKOFF_BASE_MS * 2 ** attempt);
              continue;
            }
            return {
              ok: false,
              error: {
                kind: "http",
                status: response.status,
                message: `Tubig API returned ${response.status}`,
              },
            };
          }

          if (!response.ok) {
            return {
              ok: false,
              error: {
                kind: "http",
                status: response.status,
                message: `Tubig API returned ${response.status}`,
              },
            };
          }

          let body: unknown;
          try {
            body = await response.json();
          } catch (error) {
            return {
              ok: false,
              error: { kind: "parse", message: `Invalid JSON: ${describe(error)}` },
            };
          }
          return { ok: true, data: body };
        } catch (error) {
          const retryable = isAbortError(error) || isNetworkError(error);
          if (retryable && attempt < maxRetries) {
            await sleep(RETRY_BACKOFF_BASE_MS * 2 ** attempt);
            continue;
          }
          if (isAbortError(error)) {
            return {
              ok: false,
              error: { kind: "timeout", message: `Timed out after ${timeoutMs}ms` },
            };
          }
          if (isNetworkError(error)) {
            return {
              ok: false,
              error: { kind: "network", message: `Network failure: ${describe(error)}` },
            };
          }
          return {
            ok: false,
            error: { kind: "network", message: `Request failed: ${describe(error)}` },
          };
        }
      }
    },
  };
}

/** Base URL with a trailing slash, suitable for URL resolution. */
function resolveBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/**
 * Validates an opaque `next` path from an upstream response before fetching it.
 * `next` is a relative path (e.g. `/v1/history/dams/angat/readings?limit=…&cursor=…`).
 * SSRF protection: the resolved URL must stay on the pinned base origin and on
 * the known `/v1/history/…` API paths; the query string is passed through
 * unmodified (the cursor is opaque and must not be re-encoded or rebuilt).
 */
export function resolveNextPath(baseUrl: string, nextPath: string): TubigResult<string> {
  if (nextPath.length > 2048) {
    return { ok: false, error: { kind: "parse", message: "next path too long" } };
  }
  let resolved: URL;
  let expectedOrigin: string;
  try {
    resolved = new URL(nextPath, resolveBase(baseUrl));
    expectedOrigin = new URL(resolveBase(baseUrl)).origin;
  } catch {
    return { ok: false, error: { kind: "parse", message: "unparseable next path" } };
  }
  if (resolved.origin !== expectedOrigin) {
    return {
      ok: false,
      error: { kind: "parse", message: "next path points outside the Tubig API origin" },
    };
  }
  if (!resolved.pathname.startsWith("/v1/history/")) {
    return {
      ok: false,
      error: { kind: "parse", message: "next path is not a Tubig history endpoint" },
    };
  }
  return { ok: true, data: `${resolved.pathname}${resolved.search}` };
}

