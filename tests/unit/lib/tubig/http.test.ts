import { describe, expect, it } from "vitest";
import {
  createTubigTransport,
  resolveNextPath,
  type TubigTransportConfig,
} from "@/lib/tubig/http";
import { REAL_NEXT_PATH } from "@/tests/helpers/tubig-fixtures";

const BASE = "https://tubig-api.rjhon.net";

/** Fake clock whose sleep advances time without real waiting. */
function fakeClock() {
  let time = 0;
  return {
    now: () => time,
    sleep: async (ms: number) => {
      time += ms;
    },
    advance: (ms: number) => {
      time += ms;
    },
  };
}

function makeConfig(overrides: Partial<TubigTransportConfig> = {}): {
  config: TubigTransportConfig;
  clock: ReturnType<typeof fakeClock>;
  fetchCalls: { url: string; init?: RequestInit }[];
} {
  const clock = fakeClock();
  const fetchCalls: { url: string; init?: RequestInit }[] = [];
  const config: TubigTransportConfig = {
    baseUrl: BASE,
    rateLimitPerMinute: 5,
    timeoutMs: 1_000,
    maxRetries: 2,
    fetchImpl: async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      return new Response("{}", { status: 200 });
    },
    now: clock.now,
    sleep: clock.sleep,
    ...overrides,
  };
  return { config, clock, fetchCalls };
}

describe("createTubigTransport — request pacing", () => {
  it("spaces consecutive calls to respect the per-minute budget", async () => {
    const { config, fetchCalls } = makeConfig();
    const transport = createTubigTransport(config);

    await transport.fetchJson("/v1/history/dams");
    await transport.fetchJson("/v1/history/dams");
    await transport.fetchJson("/v1/history/dams");

    // 5 calls/minute → all three calls made against the pinned base URL.
    expect(fetchCalls).toHaveLength(3);
    for (const call of fetchCalls) {
      expect(call.url).toBe(`${BASE}/v1/history/dams`);
    }
  });

  it("waits the minimum interval before each call after the first", async () => {
    const starts: number[] = [];
    const clock = fakeClock();
    const config: TubigTransportConfig = {
      baseUrl: BASE,
      rateLimitPerMinute: 5,
      fetchImpl: async () => {
        starts.push(clock.now());
        return new Response("{}", { status: 200 });
      },
      now: clock.now,
      sleep: clock.sleep,
    };
    const transport = createTubigTransport(config);

    await transport.fetchJson("/a");
    await transport.fetchJson("/b");
    await transport.fetchJson("/c");

    expect(starts).toEqual([0, 12_000, 24_000]);
  });
});

describe("createTubigTransport — rate limits", () => {
  it("honors Retry-After on a 429 and retries successfully", async () => {
    let responses = 0;
    const sleeps: number[] = [];
    const clock = fakeClock();
    const config: TubigTransportConfig = {
      baseUrl: BASE,
      maxRetries: 2,
      fetchImpl: async () => {
        responses += 1;
        if (responses === 1) {
          return new Response("too many", {
            status: 429,
            headers: { "retry-after": "30" },
          });
        }
        return new Response("{}", { status: 200 });
      },
      now: clock.now,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock.advance(ms);
      },
    };

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams");

    expect(responses).toBe(2);
    expect(sleeps).toContain(30_000);
    expect(result.ok).toBe(true);
  });

  it("gives up after the bounded retries and reports a rate-limit error", async () => {
    let responses = 0;
    const clock = fakeClock();
    const config: TubigTransportConfig = {
      baseUrl: BASE,
      maxRetries: 2,
      fetchImpl: async () => {
        responses += 1;
        return new Response("too many", {
          status: 429,
          headers: { "retry-after": "5" },
        });
      },
      now: clock.now,
      sleep: clock.sleep,
    };

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams");

    expect(responses).toBe(3); // initial attempt + 2 retries
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate-limit");
      if (result.error.kind === "rate-limit") {
        expect(result.error.retryAfterSeconds).toBe(5);
      }
    }
  });
});

describe("createTubigTransport — retries and timeouts", () => {
  it("retries transient 5xx responses and succeeds", async () => {
    let responses = 0;
    const { config } = makeConfig({
      fetchImpl: async () => {
        responses += 1;
        if (responses <= 2) return new Response("boom", { status: 500 });
        return new Response("{}", { status: 200 });
      },
    });

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams");

    expect(responses).toBe(3);
    expect(result.ok).toBe(true);
  });

  it("does not retry 4xx errors and reports an http error", async () => {
    let responses = 0;
    const { config } = makeConfig({
      fetchImpl: async () => {
        responses += 1;
        return new Response("unknown dam", { status: 404 });
      },
    });

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams/nope/readings");

    expect(responses).toBe(1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatchObject({ kind: "http", status: 404 });
    }
  });

  it("aborts hung requests and reports a timeout after bounded retries", async () => {
    let responses = 0;
    const clock = fakeClock();
    const config: TubigTransportConfig = {
      baseUrl: BASE,
      timeoutMs: 5, // real timer, kept short
      maxRetries: 1,
      fetchImpl: (_input, init) =>
        new Promise((_resolve, reject) => {
          responses += 1;
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
      now: clock.now,
      sleep: clock.sleep,
    };

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams");

    expect(responses).toBe(2); // initial attempt + 1 retry
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("timeout");
    }
  });

  it("retries network failures and reports a network error when exhausted", async () => {
    let responses = 0;
    const { config } = makeConfig({
      fetchImpl: async () => {
        responses += 1;
        throw new TypeError("fetch failed");
      },
    });

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams");

    expect(responses).toBe(3);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network");
    }
  });

  it("reports a parse error for invalid JSON bodies", async () => {
    const { config } = makeConfig({
      fetchImpl: async () => new Response("not json", { status: 200 }),
    });

    const result = await createTubigTransport(config).fetchJson("/v1/history/dams");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });
});

describe("resolveNextPath — SSRF protection for opaque cursors", () => {
  it("passes a real observed next path through unmodified", () => {
    const result = resolveNextPath(BASE, REAL_NEXT_PATH);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBe(REAL_NEXT_PATH);
    }
  });

  it("rejects absolute URLs pointing at another origin", () => {
    const result = resolveNextPath(BASE, "https://evil.example.com/v1/history/dams");
    expect(result.ok).toBe(false);
  });

  it("rejects protocol-relative host redirections", () => {
    const result = resolveNextPath(BASE, "//evil.example.com/v1/history/dams");
    expect(result.ok).toBe(false);
  });

  it("rejects paths outside the Tubig history API", () => {
    const result = resolveNextPath(BASE, "/admin");
    expect(result.ok).toBe(false);
  });

  it("rejects absurdly long paths", () => {
    const result = resolveNextPath(BASE, `/v1/history/dams?cursor=${"x".repeat(3000)}`);
    expect(result.ok).toBe(false);
  });
});
