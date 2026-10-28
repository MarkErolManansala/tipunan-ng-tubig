import type { ZodType } from "zod";
import {
  damIdSchema,
  damListSchema,
  damReadingsSchema,
  type TubigDamList,
  type TubigDamReadings,
} from "@/lib/tubig/schemas";
import {
  resolveNextPath,
  type TubigResult,
  type TubigTransport,
} from "@/lib/tubig/http";

/** Client interface for the Tubig dam endpoints. */
export interface TubigClient {
  fetchDamsPage(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<TubigResult<TubigDamList>>;
  followDamsNext(nextPath: string): Promise<TubigResult<TubigDamList>>;
  fetchDamReadingsPage(options: {
    damId: string;
    limit?: number;
    cursor?: string;
    /** Manila calendar date (YYYY-MM-DD) passed through unmodified. */
    from?: string;
    to?: string;
  }): Promise<TubigResult<TubigDamReadings>>;
  followDamReadingsNext(nextPath: string): Promise<TubigResult<TubigDamReadings>>;
}

function parseWith<T>(schema: ZodType<T>, body: unknown): TubigResult<T> {
  const result = schema.safeParse(body);
  if (result.success) return { ok: true, data: result.data };
  const summary = result.error.issues
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
  return { ok: false, error: { kind: "parse", message: summary } };
}

function buildQuery(
  params: Record<string, string | number | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : "";
}

/**
 * Endpoint client over the transport. Every response is validated with zod
 * before it leaves this module; the opaque `next` path is passed through the
 * SSRF-checked resolver without being rebuilt.
 */
export function createTubigClient(transport: TubigTransport): TubigClient {
  async function fetchPath<T>(
    path: string,
    schema: ZodType<T>,
  ): Promise<TubigResult<T>> {
    const body = await transport.fetchJson(path);
    if (!body.ok) return body;
    return parseWith(schema, body.data);
  }

  async function followNext<T>(
    nextPath: string,
    schema: ZodType<T>,
  ): Promise<TubigResult<T>> {
    const path = resolveNextPath(transport.baseUrl, nextPath);
    if (!path.ok) return path;
    return fetchPath(path.data, schema);
  }

  return {
    async fetchDamsPage(options = {}) {
      const query = buildQuery({ limit: options.limit, cursor: options.cursor });
      return fetchPath(`/v1/history/dams${query}`, damListSchema);
    },

    followDamsNext(nextPath) {
      return followNext(nextPath, damListSchema);
    },

    async fetchDamReadingsPage(options) {
      // The dam id is embedded in the request path — validate it against the
      // API's own slug pattern before building the path (SSRF/injection guard).
      const damId = damIdSchema.safeParse(options.damId);
      if (!damId.success) {
        return {
          ok: false,
          error: {
            kind: "parse",
            message: `invalid dam id: ${options.damId}`,
          },
        };
      }
      const query = buildQuery({
        limit: options.limit,
        cursor: options.cursor,
        from: options.from,
        to: options.to,
      });
      return fetchPath(
        `/v1/history/dams/${options.damId}/readings${query}`,
        damReadingsSchema,
      );
    },

    followDamReadingsNext(nextPath) {
      return followNext(nextPath, damReadingsSchema);
    },
  };
}
