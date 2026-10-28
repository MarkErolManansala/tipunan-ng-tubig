import { describe, expect, it } from "vitest";
import type { AppSupabaseClient } from "@/lib/supabase/server";
import {
  createDamsRepository,
} from "@/features/dams/repositories/dams-repository";
import {
  RepositoryError,
  SyncAlreadyRunningError,
} from "@/features/dams/repositories/errors";
import {
  createSyncRunsRepository,
} from "@/features/dams/repositories/sync-runs-repository";
import type { DamInsert, DamReadingInsert, SyncRunRow } from "@/types/database";

/**
 * Chain-recording fake of the supabase-js query builder. Repositories are thin
 * glue over the real client; these tests pin the critical protocol details:
 * the `onConflict` targets (which must match the migration's unique
 * constraints) and the 23505 → SyncAlreadyRunningError mapping.
 */

type TableOp = {
  table: string;
  method: string;
  payload?: unknown;
  options?: unknown;
  columns?: string;
  filters: { col: string; val: unknown }[];
  orders: { col: string; ascending: boolean }[];
  limit?: number;
  terminal?: "single" | "maybeSingle";
};

type Outcome = { data?: unknown; error?: { code?: string; message: string } | null };

function fakeSupabase(respond: (op: TableOp) => Outcome) {
  const ops: TableOp[] = [];
  const client = {
    from(table: string) {
      const op: TableOp = { table, method: "select", filters: [], orders: [] };
      ops.push(op);
      const builder = {
        upsert(payload: unknown, options?: unknown) {
          op.method = "upsert";
          op.payload = payload;
          op.options = options;
          return builder;
        },
        insert(payload: unknown) {
          op.method = "insert";
          op.payload = payload;
          return builder;
        },
        update(payload: unknown) {
          op.method = "update";
          op.payload = payload;
          return builder;
        },
        select(columns: string) {
          op.columns = columns;
          return builder;
        },
        single() {
          op.terminal = "single";
          return builder;
        },
        maybeSingle() {
          op.terminal = "maybeSingle";
          return builder;
        },
        eq(col: string, val: unknown) {
          op.filters.push({ col, val });
          return builder;
        },
        order(col: string, options: { ascending: boolean }) {
          op.orders.push({ col, ...options });
          return builder;
        },
        limit(n: number) {
          op.limit = n;
          return builder;
        },
        // Thenable: awaiting the builder resolves the configured outcome.
        then(
          onFulfilled?: (value: Outcome) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve(respond(op)).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as AppSupabaseClient, ops };
}

const damRow: DamInsert = {
  id: "angat",
  name: "Angat Dam",
  thresholds: { spilling: 217.0 },
  updated_at: "2026-10-28T00:00:00.000Z",
};

const readingRow: DamReadingInsert = {
  dam_id: "angat",
  observed_at: "2026-10-28T00:00:00.000Z",
  level_m: 208.94,
  rule_curve_m: 196.19,
  normal_high_m: 210.0,
  change_24h_m: -0.09,
  source: "pagasa_dams",
};

describe("DamsRepository", () => {
  it("upserts dams with onConflict 'id'", async () => {
    const { client, ops } = fakeSupabase(() => ({}));

    await createDamsRepository(client).upsertDams([damRow]);

    expect(ops[0]).toMatchObject({
      table: "dams",
      method: "upsert",
      payload: [damRow],
      options: { onConflict: "id" },
    });
  });

  it("skips empty dam batches without issuing a query", async () => {
    const { client, ops } = fakeSupabase(() => ({}));

    await createDamsRepository(client).upsertDams([]);

    expect(ops).toHaveLength(0);
  });

  it("upserts readings with the (dam_id, observed_at) conflict target", async () => {
    const { client, ops } = fakeSupabase(() => ({}));

    await createDamsRepository(client).upsertReadings([readingRow]);

    expect(ops[0]).toMatchObject({
      table: "dam_readings",
      method: "upsert",
      options: { onConflict: "dam_id,observed_at" },
    });
  });

  it("wraps Supabase errors in RepositoryError", async () => {
    const { client } = fakeSupabase(() => ({ error: { message: "connection refused" } }));

    await expect(
      createDamsRepository(client).upsertReadings([readingRow]),
    ).rejects.toBeInstanceOf(RepositoryError);
  });
});

describe("DamsRepository reads", () => {
  it("lists dams ordered by name", async () => {
    const rows = [{ id: "angat", name: "Angat Dam" }];
    const { client, ops } = fakeSupabase(() => ({ data: rows }));

    const dams = await createDamsRepository(client).listDams();

    expect(dams).toEqual(rows);
    expect(ops[0]).toMatchObject({
      table: "dams",
      method: "select",
      orders: [{ col: "name", ascending: true }],
    });
  });

  it("gets a dam by id with maybeSingle", async () => {
    const row = { id: "angat", name: "Angat Dam" };
    const { client, ops } = fakeSupabase(() => ({ data: row }));

    const dam = await createDamsRepository(client).getDam("angat");

    expect(dam).toEqual(row);
    expect(ops[0]).toMatchObject({
      table: "dams",
      filters: [{ col: "id", val: "angat" }],
      terminal: "maybeSingle",
    });
  });

  it("returns null for an unknown dam id", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: null }));

    const dam = await createDamsRepository(client).getDam("nope");

    expect(dam).toBeNull();
  });

  it("reads latest readings from the latest_dam_readings view", async () => {
    const rows = [{ dam_id: "angat", observed_at: "2026-10-28T00:00:00.000Z" }];
    const { client, ops } = fakeSupabase(() => ({ data: rows }));

    const readings = await createDamsRepository(client).listLatestReadings();

    expect(readings).toEqual(rows);
    expect(ops[0]).toMatchObject({
      table: "latest_dam_readings",
      method: "select",
    });
  });

  it("lists a dam's recent readings filtered, newest first, and limited", async () => {
    const rows = [{ dam_id: "angat", observed_at: "2026-10-28T00:00:00.000Z" }];
    const { client, ops } = fakeSupabase(() => ({ data: rows }));

    const readings = await createDamsRepository(client).listRecentReadings(
      "angat",
      30,
    );

    expect(readings).toEqual(rows);
    expect(ops[0]).toMatchObject({
      table: "dam_readings",
      filters: [{ col: "dam_id", val: "angat" }],
      orders: [{ col: "observed_at", ascending: false }],
      limit: 30,
    });
  });

  it("wraps read failures in RepositoryError", async () => {
    const { client } = fakeSupabase(() => ({ error: { message: "read failed" } }));

    await expect(createDamsRepository(client).listDams()).rejects.toBeInstanceOf(
      RepositoryError,
    );
  });
});

describe("SyncRunsRepository", () => {
  it("creates a run and returns the resulting row", async () => {
    const row: Partial<SyncRunRow> = { id: 7, status: "running", mode: "routine" };
    const { client, ops } = fakeSupabase(() => ({ data: row }));

    const run = await createSyncRunsRepository(client).createRun("dams", "routine");

    expect(run.id).toBe(7);
    expect(ops[0]).toMatchObject({
      table: "sync_runs",
      method: "insert",
      payload: { kind: "dams", mode: "routine" },
      terminal: "single",
    });
  });

  it("maps the 23505 unique violation to SyncAlreadyRunningError", async () => {
    const { client } = fakeSupabase(() => ({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    }));

    await expect(
      createSyncRunsRepository(client).createRun("dams", "routine"),
    ).rejects.toBeInstanceOf(SyncAlreadyRunningError);
  });

  it("finalizes a run with a filtered update on id", async () => {
    const { client, ops } = fakeSupabase(() => ({}));

    await createSyncRunsRepository(client).finishRun(7, {
      status: "succeeded",
      finished_at: "2026-10-28T00:05:00.000Z",
      pages_fetched: 3,
      items_upserted: 10,
      last_cursor: null,
      error: null,
    });

    expect(ops[0]).toMatchObject({
      table: "sync_runs",
      method: "update",
      payload: {
        status: "succeeded",
        pages_fetched: 3,
        items_upserted: 10,
      },
      filters: [{ col: "id", val: 7 }],
    });
  });

  it("reads the latest run with deterministic ordering and maybeSingle", async () => {
    const row: Partial<SyncRunRow> = { id: 7, status: "failed", last_cursor: { angat: "c2" } };
    const { client, ops } = fakeSupabase(() => ({ data: row }));

    const run = await createSyncRunsRepository(client).getLatestRun("dams", "backfill");

    expect(run?.id).toBe(7);
    expect(ops[0]).toMatchObject({
      table: "sync_runs",
      filters: [
        { col: "kind", val: "dams" },
        { col: "mode", val: "backfill" },
      ],
      orders: [
        { col: "started_at", ascending: false },
        { col: "id", ascending: false },
      ],
      limit: 1,
      terminal: "maybeSingle",
    });
  });

  it("returns null when no run exists", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: null }));

    const run = await createSyncRunsRepository(client).getLatestRun("dams", "backfill");

    expect(run).toBeNull();
  });

  it("reads the latest successful run filtered on status", async () => {
    const row: Partial<SyncRunRow> = { id: 9, status: "succeeded", mode: "routine" };
    const { client, ops } = fakeSupabase(() => ({ data: row }));

    const run = await createSyncRunsRepository(client).getLatestSuccessfulRun("dams");

    expect(run?.id).toBe(9);
    expect(ops[0]).toMatchObject({
      table: "sync_runs",
      filters: [
        { col: "kind", val: "dams" },
        { col: "status", val: "succeeded" },
      ],
      orders: [
        { col: "started_at", ascending: false },
        { col: "id", ascending: false },
      ],
      limit: 1,
      terminal: "maybeSingle",
    });
  });

  it("returns null when no successful run exists", async () => {
    const { client } = fakeSupabase(() => ({ data: null, error: null }));

    const run = await createSyncRunsRepository(client).getLatestSuccessfulRun("dams");

    expect(run).toBeNull();
  });
});
