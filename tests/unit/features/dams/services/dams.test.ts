import { describe, expect, it } from "vitest";
import { createDamsService } from "@/features/dams/services/dams";
import {
  FakeDamsRepository,
  FakeSyncRunsRepository,
} from "@/tests/helpers/fake-repositories";
import type {
  DamReadingRow,
  DamRow,
  LatestDamReadingRow,
  SyncRunRow,
} from "@/types/database";
import type { Json } from "@/types/database.types";

/**
 * Read-side service tests against the in-memory repository fakes. The fakes
 * serve configurable row fixtures for the read methods, so these tests pin
 * the shaping logic: dam/reading zipping, thresholds narrowing, nullability,
 * and the freshness lookup.
 */

function makeDam(id: string, name: string, thresholds: Json = {}): DamRow {
  return {
    id,
    name,
    thresholds,
    created_at: "2026-10-28T00:00:00.000Z",
    updated_at: "2026-10-28T00:00:00.000Z",
  } as DamRow;
}

function makeLatestReading(
  damId: string,
  overrides: Partial<LatestDamReadingRow> = {},
): LatestDamReadingRow {
  return {
    dam_id: damId,
    observed_at: "2026-10-28T00:00:00.000Z",
    level_m: 208.94,
    rule_curve_m: 196.19,
    normal_high_m: 210.0,
    change_24h_m: -0.09,
    source: "pagasa_dams",
    ...overrides,
  };
}

function makeReadingRow(
  damId: string,
  overrides: Partial<DamReadingRow> = {},
): DamReadingRow {
  return {
    id: 1,
    dam_id: damId,
    observed_at: "2026-10-28T00:00:00.000Z",
    level_m: 208.94,
    rule_curve_m: 196.19,
    normal_high_m: 210.0,
    change_24h_m: -0.09,
    source: "pagasa_dams",
    created_at: "2026-10-28T00:00:00.000Z",
    ...overrides,
  };
}

function makeService() {
  const dams = new FakeDamsRepository();
  const syncRuns = new FakeSyncRunsRepository();
  return { service: createDamsService({ dams, syncRuns }), dams, syncRuns };
}

describe("createDamsService — listDamSummaries", () => {
  it("zips dams with their latest reading by dam id", async () => {
    const { service, dams } = makeService();
    dams.damRows = [makeDam("angat", "Angat Dam"), makeDam("la_mesa", "La Mesa Dam")];
    dams.latestReadingRows = [
      makeLatestReading("angat"),
      makeLatestReading("la_mesa", { level_m: null, change_24h_m: null }),
    ];

    const summaries = await service.listDamSummaries();

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      id: "angat",
      name: "Angat Dam",
      thresholds: {},
      latest: { observedAt: "2026-10-28T00:00:00.000Z", levelM: 208.94 },
    });
    // Nullable fields survive as null, never zero.
    expect(summaries[1].latest).toMatchObject({ levelM: null, change24hM: null });
  });

  it("carries the dam's narrowed thresholds into summaries for status ranking", async () => {
    const { service, dams } = makeService();
    dams.damRows = [
      makeDam("angat", "Angat Dam", { critical: 217.0, spilling: null }),
    ];

    const summaries = await service.listDamSummaries();

    // Thresholds jsonb is narrowed verbatim at the read boundary — numbers
    // and nulls both survive; numericThresholds() filters the nulls later
    // when a status is derived.
    expect(summaries[0].thresholds).toEqual({ critical: 217.0, spilling: null });
  });

  it("yields latest: null for a dam without any reading", async () => {
    const { service, dams } = makeService();
    dams.damRows = [makeDam("angat", "Angat Dam")];

    const summaries = await service.listDamSummaries();

    expect(summaries[0].latest).toBeNull();
  });
});

describe("createDamsService — getDamDetail", () => {
  it("returns the dam with thresholds narrowed and readings newest first", async () => {
    const { service, dams } = makeService();
    dams.damRows = [makeDam("angat", "Angat Dam", { spilling: 217.0 })];
    dams.readingRows = [
      makeReadingRow("angat", { observed_at: "2026-10-27T00:00:00.000Z" }),
      makeReadingRow("angat"),
    ];

    const detail = await service.getDamDetail("angat");

    expect(detail).toMatchObject({
      id: "angat",
      name: "Angat Dam",
      thresholds: { spilling: 217.0 },
      updatedAt: "2026-10-28T00:00:00.000Z",
    });
    expect(detail?.readings).toHaveLength(2);
    expect(detail?.readings[0].observedAt).toBe("2026-10-28T00:00:00.000Z");
  });

  it("returns null for an unknown dam id", async () => {
    const { service } = makeService();

    const detail = await service.getDamDetail("nope");

    expect(detail).toBeNull();
  });

  it("narrows non-object thresholds to an empty object", async () => {
    const { service, dams } = makeService();
    // jsonb is typed loosely; a non-object should never occur but must not crash.
    dams.damRows = [makeDam("angat", "Angat Dam", null)];

    const detail = await service.getDamDetail("angat");

    expect(detail?.thresholds).toEqual({});
  });
});

describe("createDamsService — getLastSuccessfulSyncAt", () => {
  it("returns the finished_at of the latest successful run", async () => {
    const { service, syncRuns } = makeService();
    const succeeded: Partial<SyncRunRow> = {
      id: 1,
      kind: "dams",
      mode: "routine",
      status: "succeeded",
      finished_at: "2026-10-28T03:05:00.000Z",
    };
    syncRuns.runs.push({ ...succeeded } as SyncRunRow);

    const finishedAt = await service.getLastSuccessfulSyncAt();

    expect(finishedAt).toBe("2026-10-28T03:05:00.000Z");
  });

  it("returns null before the first successful sync", async () => {
    const { service } = makeService();

    const finishedAt = await service.getLastSuccessfulSyncAt();

    expect(finishedAt).toBeNull();
  });
});
