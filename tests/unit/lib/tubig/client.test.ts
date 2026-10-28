import { describe, expect, it } from "vitest";
import { createTubigClient } from "@/lib/tubig/client";
import type { TubigTransport } from "@/lib/tubig/http";
import {
  makeDam,
  makeDamList,
  makeReading,
  REAL_NEXT_PATH,
  TUBIG_SOURCES,
} from "@/tests/helpers/tubig-fixtures";

const BASE = "https://tubig-api.rjhon.net";

function fakeTransport(
  handler: (path: string) => unknown,
): TubigTransport & { paths: string[] } {
  const paths: string[] = [];
  return {
    baseUrl: BASE,
    paths,
    async fetchJson(path) {
      paths.push(path);
      return { ok: true, data: handler(path) };
    },
  };
}

describe("Tubig client — dam list", () => {
  it("fetches the dam list with the configured limit and validates it", async () => {
    const body = makeDamList([makeDam(), makeDam({ id: "ipo", name: "Ipo Dam", thresholds: { spilling: 101.1 } })]);
    const transport = fakeTransport(() => body);
    const client = createTubigClient(transport);

    const result = await client.fetchDamsPage({ limit: 500 });

    expect(transport.paths).toEqual(["/v1/history/dams?limit=500"]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.items).toHaveLength(2);
      expect(result.data.sources).toEqual(TUBIG_SOURCES);
    }
  });

  it("rejects malformed dam-list payloads with a parse error", async () => {
    const transport = fakeTransport(() => ({ items: "not-an-array", next: null }));
    const client = createTubigClient(transport);

    const result = await client.fetchDamsPage();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });

  it("rejects payloads with unknown dam id shapes", async () => {
    const transport = fakeTransport(() =>
      makeDamList([makeDam({ id: "Angat Dam!" })]),
    );
    const client = createTubigClient(transport);

    const result = await client.fetchDamsPage();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("parse");
    }
  });
});

describe("Tubig client — dam readings", () => {
  it("passes limit, cursor, and Manila-date filters through verbatim", async () => {
    const transport = fakeTransport(() => ({
      items: [makeReading()],
      next: null,
      sources: TUBIG_SOURCES,
    }));
    const client = createTubigClient(transport);

    await client.fetchDamReadingsPage({
      damId: "angat",
      limit: 3,
      cursor: "opaque-cursor-value",
      from: "2026-10-01",
      to: "2026-10-28",
    });

    expect(transport.paths).toEqual([
      "/v1/history/dams/angat/readings?limit=3&cursor=opaque-cursor-value&from=2026-10-01&to=2026-10-28",
    ]);
  });

  it("rejects dam ids that are not URL slugs without making a request", async () => {
    const transport = fakeTransport(() => ({ items: [], next: null, sources: [] }));
    const client = createTubigClient(transport);

    const result = await client.fetchDamReadingsPage({ damId: "../secret" });

    expect(result.ok).toBe(false);
    expect(transport.paths).toEqual([]);
  });

  it("follows a real observed next path without rebuilding it", async () => {
    const transport = fakeTransport(() => ({
      items: [makeReading({ observed_at: "2026-10-26T00:00:00Z" })],
      next: null,
      sources: TUBIG_SOURCES,
    }));
    const client = createTubigClient(transport);

    const result = await client.followDamReadingsNext(REAL_NEXT_PATH);

    expect(transport.paths).toEqual([REAL_NEXT_PATH]);
    expect(result.ok).toBe(true);
  });

  it("refuses to follow a next path that leaves the pinned origin", async () => {
    const transport = fakeTransport(() => ({ items: [], next: null, sources: [] }));
    const client = createTubigClient(transport);

    const result = await client.followDamReadingsNext(
      "https://evil.example.com/v1/history/dams/angat/readings?cursor=x",
    );

    expect(result.ok).toBe(false);
    expect(transport.paths).toEqual([]);
  });
});
