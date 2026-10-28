import { describe, expect, it } from "vitest";
import { syncDams } from "@/features/dams/sync/sync-dams";
import type { TubigDamReadings } from "@/lib/tubig/schemas";
import { FakeDamsRepository, FakeSyncRunsRepository } from "@/tests/helpers/fake-repositories";
import { FakeTubigClient } from "@/tests/helpers/fake-tubig-client";
import {
  makeDam,
  makeDamList,
  makeMinimalDam,
  makeReading,
} from "@/tests/helpers/tubig-fixtures";

function readingsPage(
  items: TubigDamReadings["items"],
  next: string | null = null,
): TubigDamReadings {
  return { items, next, sources: [] };
}

function makeDeps(overrides: Partial<Parameters<typeof syncDams>[0]> = {}) {
  const dams = new FakeDamsRepository();
  const syncRuns = new FakeSyncRunsRepository();
  const tubig = new FakeTubigClient();
  tubig.damsQueue.push({
    ok: true,
    data: makeDamList([makeDam(), makeMinimalDam()]),
  });
  tubig.readingsQueue.push({
    ok: true,
    data: readingsPage([makeReading()]),
  });
  return { deps: { dams, syncRuns, tubig, ...overrides }, dams, syncRuns, tubig };
}

describe("syncDams — routine mode", () => {
  it("upserts dam metadata, latest readings, and the newest historical page", async () => {
    const { deps, dams, syncRuns } = makeDeps();

    const outcome = await syncDams(deps);

    expect(outcome.ok).toBe(true);
    // 2 dams metadata + 1 latest reading + 1 historical reading
    expect(dams.dams.size).toBe(2);
    expect(dams.readings.size).toBe(2);
    expect(dams.readings.get("angat|2026-10-28T00:00:00.000Z")).toMatchObject({
      level_m: 208.94,
      source: "pagasa_dams",
    });
    // Ambuklao: empty thresholds and no latest reading must survive as-is.
    expect(dams.dams.get("ambuklao")?.thresholds).toEqual({});
    const finishedRun = syncRuns.runs[0];
    expect(finishedRun.status).toBe("succeeded");
    expect(finishedRun.last_cursor).toBeNull();
    expect(finishedRun.pages_fetched).toBe(3); // 1 dam list + 2 readings pages
  });

  it("preserves nullable fields as null instead of coercing to zero", async () => {
    const { deps, dams, tubig } = makeDeps();
    tubig.readingsQueue = [
      {
        ok: true,
        data: readingsPage([
          makeReading({
            level_m: null,
            rule_curve_m: null,
            normal_high_m: null,
            change_24h_m: null,
            source: null,
          }),
        ]),
      },
    ];

    const outcome = await syncDams(deps);

    expect(outcome.ok).toBe(true);
    const stored = dams.readings.get("angat|2026-10-28T00:00:00.000Z");
    expect(stored).toEqual({
      dam_id: "angat",
      observed_at: "2026-10-28T00:00:00.000Z",
      level_m: null,
      rule_curve_m: null,
      normal_high_m: null,
      change_24h_m: null,
      source: null,
    });
  });

  it("repeated runs do not duplicate readings", async () => {
    const { deps, dams } = makeDeps();

    await syncDams(deps);
    const countAfterFirstRun = dams.readings.size;
    await syncDams(deps); // same upstream data again

    expect(dams.readings.size).toBe(countAfterFirstRun);
    // 2 runs × (1 latest upsert + 1 page per dam) = 6 upsert calls
    expect(dams.readingUpsertCalls).toHaveLength(6);
  });

  it("fetches only the newest page per dam in routine mode", async () => {
    const { deps, tubig } = makeDeps();

    await syncDams(deps);

    const readingCalls = tubig.calls.filter((c) => c.op === "fetchDamReadingsPage");
    expect(readingCalls).toHaveLength(2); // one per dam, no follow-ups
  });

  it("aggregates dam lists that span multiple pages", async () => {
    const { deps, dams, tubig } = makeDeps();
    tubig.damsQueue = [
      { ok: true, data: makeDamList([makeDam()], "/v1/history/dams?cursor=page2") },
      { ok: true, data: makeDamList([makeMinimalDam()]) },
    ];

    const outcome = await syncDams(deps);

    expect(outcome.ok).toBe(true);
    expect(dams.dams.size).toBe(2);
  });
});

describe("syncDams — failures", () => {
  it("records a failed run when the upstream API is unreachable", async () => {
    const { deps, syncRuns, tubig } = makeDeps();
    tubig.readingsQueue = [
      { ok: false, error: { kind: "network", message: "fetch failed" } },
    ];

    const outcome = await syncDams(deps);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe("sync-failed");
    const finishedRun = syncRuns.runs[0];
    expect(finishedRun.status).toBe("failed");
    expect(finishedRun.error).toContain("network");
  });

  it("leaves already-persisted data intact on partial failure, then recovers", async () => {
    const { deps, dams, tubig } = makeDeps();
    // Dam list order: angat first, ambuklao second. Fail ambuklao's first page.
    tubig.readingsQueue = [
      { ok: true, data: readingsPage([makeReading()]) },
      { ok: false, error: { kind: "http", status: 500, message: "upstream down" } },
    ];

    const failed = await syncDams(deps);
    expect(failed.ok).toBe(false);
    // angat's latest reading was persisted before the failure (its historical
    // page contains the same observation, so the unique key deduplicates it).
    expect(dams.readings.size).toBe(1);
    expect(dams.dams.size).toBe(2);

    // Upstream recovers; a re-run must complete without duplicating rows.
    // (Its page is served for both dams, so ambuklao gains its own row now.)
    tubig.readingsQueue = [{ ok: true, data: readingsPage([makeReading()]) }];
    const recovered = await syncDams(deps);
    expect(recovered.ok).toBe(true);
    expect(dams.readings.size).toBe(2);
  });

  it("refuses to start when a run of the same kind is already running", async () => {
    const { deps, syncRuns } = makeDeps();
    // Simulate a concurrent run created by another worker.
    await syncRuns.createRun("dams", "routine");

    const outcome = await syncDams(deps);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) expect(outcome.code).toBe("already-running");
    expect(syncRuns.runs).toHaveLength(1); // no second run row created
  });
});

describe("syncDams — backfill mode", () => {
  function backfillDeps() {
    const deps = makeDeps();
    // Single dam so the scripted queue maps cleanly to its page sequence.
    deps.tubig.damsQueue = [{ ok: true, data: makeDamList([makeDam()]) }];
    // Page 1 via a fresh fetch; pages 2–3 via cursor-following.
    deps.tubig.readingsQueue = [
      { ok: true, data: readingsPage([makeReading()], "/v1/history/dams/angat/readings?cursor=c2") },
    ];
    deps.tubig.followReadingsQueue = [
      { ok: true, data: readingsPage([makeReading({ observed_at: "2026-10-27T00:00:00Z", change_24h_m: null })], "/v1/history/dams/angat/readings?cursor=c3") },
      { ok: true, data: readingsPage([makeReading({ observed_at: "2026-10-26T00:00:00Z", change_24h_m: null })]) },
    ];
    deps.deps.maxBackfillPagesPerDam = 1;
    return deps;
  }

  it("resumes an interrupted backfill from the persisted cursors without duplicating data", async () => {
    const { deps, dams, syncRuns } = backfillDeps();

    // Run 1: fetches page 1, hits the 1-page cap, saves the cursor.
    // (Page 1 carries the same observation as the latest reading, so the
    // unique (dam_id, observed_at) key collapses them into one row.)
    const run1 = await syncDams(deps, "backfill");
    expect(run1.ok).toBe(true);
    expect(dams.readings.size).toBe(1);
    const run1Row = syncRuns.runs[0];
    expect(run1Row.last_cursor).toEqual({ angat: "/v1/history/dams/angat/readings?cursor=c2" });

    // Run 2: resumes from the saved cursor, fetches page 2, caps again.
    const run2 = await syncDams(deps, "backfill");
    expect(run2.ok).toBe(true);
    expect(dams.readings.size).toBe(2);
    expect(syncRuns.runs[1].last_cursor).toEqual({ angat: "/v1/history/dams/angat/readings?cursor=c3" });

    // Run 3: completes the dam and clears the cursors.
    const run3 = await syncDams(deps, "backfill");
    expect(run3.ok).toBe(true);
    expect(dams.readings.size).toBe(3); // no duplicates across runs
    expect(syncRuns.runs[2].last_cursor).toBeNull();
    expect(syncRuns.runs.every((r) => r.status === "succeeded")).toBe(true);
  });

  it("passes the resume cursor to the client verbatim", async () => {
    const { deps, tubig } = backfillDeps();

    await syncDams(deps, "backfill"); // run 1 saves cursor c2
    await syncDams(deps, "backfill"); // run 2 must follow c2

    const followCalls = tubig.calls.filter((c) => c.op === "followDamReadingsNext");
    expect(followCalls[0]).toEqual({
      op: "followDamReadingsNext",
      path: "/v1/history/dams/angat/readings?cursor=c2",
    });
  });
});
