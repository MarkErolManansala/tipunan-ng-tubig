import type { TubigClient } from "@/lib/tubig/client";
import type { TubigResult } from "@/lib/tubig/http";
import type { TubigDamList, TubigDamReadings } from "@/lib/tubig/schemas";

export type TubigOperation =
  | { op: "fetchDamsPage"; limit?: number; cursor?: string }
  | { op: "followDamsNext"; path: string }
  | { op: "fetchDamReadingsPage"; damId: string; limit?: number; cursor?: string; from?: string; to?: string }
  | { op: "followDamReadingsNext"; path: string };

/**
 * Scripted Tubig client for integration tests. Each method pops the next
 * result from its queue (the last entry repeats when the queue is empty) and
 * records every call for assertions. Inject failures by pushing an error.
 */
export class FakeTubigClient implements TubigClient {
  damsQueue: TubigResult<TubigDamList>[] = [];
  readingsQueue: TubigResult<TubigDamReadings>[] = [];
  followReadingsQueue: TubigResult<TubigDamReadings>[] = [];
  calls: TubigOperation[] = [];

  async fetchDamsPage(
    options: { limit?: number; cursor?: string } = {},
  ): Promise<TubigResult<TubigDamList>> {
    this.calls.push({ op: "fetchDamsPage", ...options });
    return this.take(this.damsQueue, { ok: true, data: { items: [], next: null, sources: [] } });
  }

  async followDamsNext(nextPath: string): Promise<TubigResult<TubigDamList>> {
    this.calls.push({ op: "followDamsNext", path: nextPath });
    return this.take(this.damsQueue, { ok: true, data: { items: [], next: null, sources: [] } });
  }

  async fetchDamReadingsPage(options: {
    damId: string;
    limit?: number;
    cursor?: string;
    from?: string;
    to?: string;
  }): Promise<TubigResult<TubigDamReadings>> {
    this.calls.push({ op: "fetchDamReadingsPage", ...options });
    return this.take(this.readingsQueue, { ok: true, data: { items: [], next: null, sources: [] } });
  }

  async followDamReadingsNext(nextPath: string): Promise<TubigResult<TubigDamReadings>> {
    this.calls.push({ op: "followDamReadingsNext", path: nextPath });
    return this.take(this.followReadingsQueue, { ok: true, data: { items: [], next: null, sources: [] } });
  }

  private take<T>(
    queue: TubigResult<T>[],
    fallback: TubigResult<T>,
  ): TubigResult<T> {
    if (queue.length === 0) return fallback;
    if (queue.length === 1) return queue[0]; // last entry repeats
    return queue.shift() ?? fallback;
  }
}
