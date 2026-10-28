import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight } from "lucide-react";
import { ContourField } from "@/components/dams/contour-field";
import {
  DamDirectory,
  DamDirectoryFallback,
} from "@/components/dams/dam-directory";
import { DamStatusBadge } from "@/components/dams/dam-status-badge";
import {
  formatAge,
  formatChange,
  formatObservedAt,
  formatLevel,
  isStaleReading,
} from "@/components/dams/format";
import { deriveDamStatus, tierRank } from "@/components/dams/status";
import { createPublicDamsService } from "@/features/dams";
import type { DamSummary } from "@/features/dams";
import Link from "next/link";

/*
 * Home = the monitoring dashboard. With cacheComponents enabled the data
 * read is uncached and streams behind a Suspense boundary: the hero shell is
 * prerendered, the dashboard content renders at request time. (Once a
 * database is linked the read can move into `use cache`.)
 */
export default function Home() {
  return (
    <main className="flex-1">
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <ContourField className="absolute inset-0 h-full w-full text-water-300" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pt-8 pb-16 md:pt-8 md:pb-16">
          <p className="text-xs font-semibold tracking-wide uppercase text-ink-meta">
            Philippine dam monitoring
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl leading-[1.04] font-semibold tracking-tight md:text-[44px]">
            Reservoir intelligence for Philippine dams
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-6 text-white/70">
            Water levels, rule curves and published thresholds, collected
            daily from the Tubig API (PAGASA dam observations).
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="#directory"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-navy-900 transition-colors hover:bg-water-wash focus-visible:ring-3 focus-visible:ring-water-300 focus-visible:outline-none"
            >
              Browse the dam directory
                <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section id="directory" className="mx-auto w-full max-w-6xl px-6 pt-8">
        <Suspense fallback={<DamDirectoryFallback />}>
          <Dashboard />
        </Suspense>
      </section>

    </main>
  );
}

async function Dashboard() {
  // Request-time read: the database is not available at prerender (see
  // app/page.tsx comment).
  await connection();
  const service = createPublicDamsService();
  const nowIso = new Date().toISOString();
  const [dams, lastSyncedAt] = await Promise.all([
    service.listDamSummaries(),
    service.getLastSuccessfulSyncAt(),
  ]);

  return (
    <div className="pb-16">
      <OverviewLine dams={dams} lastSyncedAt={lastSyncedAt} />
      <NeedsAttention dams={dams} nowIso={nowIso} />
      <h2 className="mt-10 text-2xl font-semibold tracking-tight text-ink">
        Dam directory
      </h2>
      <p className="mt-1 text-sm text-ink-meta">
        {dams.length} dams · search, filter by status, sort to compare.
      </p>
      <div className="mt-4">
        <DamDirectory dams={dams} nowIso={nowIso} />
      </div>
      
      <p className="mt-4 text-xs leading-5 text-ink-meta">
        Observed times are PHT; a dash means the value is unknown (never zero).
        Status tiers are computed from each dam&apos;s published thresholds (see
        the footer for the rule).
      </p>

      <p className="text-xs leading-5 text-ink-meta">
        Status tiers are computed by this application from each dam&apos;s
        published numeric thresholds (not an official operational
        declaration). Details on each dam page.
      </p>
    </div>
  );
}

function OverviewLine({
  dams,
  lastSyncedAt,
}: {
  dams: DamSummary[];
  lastSyncedAt: string | null;
}) {
  const withReadings = dams.filter((dam) => dam.latest !== null).length;
  return (
    <div className="flex flex-col gap-2 border-b border-hairline pb-5 md:flex-row md:items-baseline md:justify-between">
      <p className="text-sm text-ink-meta">
        <span className="font-mono font-semibold text-ink tabular-nums">
          {dams.length}
        </span>{" "}
        dams monitored ·{" "}
        <span className="font-mono font-semibold text-ink tabular-nums">
          {withReadings}
        </span>{" "}
        with a current reading
      </p>
      <p className="font-mono text-xs text-ink-meta tabular-nums">
        {lastSyncedAt === null
          ? "Waiting for the first synchronization run"
          : `Data as of ${formatObservedAt(lastSyncedAt)} · synced daily ~11:00 PHT`}
      </p>
    </div>
  );
}

/**
 * Dams currently at or past a documented threshold, ranked by tier. Only
 * source-published numeric thresholds drive this; dams without them never
 * appear here. Shows at most five — the rest are reachable via directory
 * filters.
 */
function NeedsAttention({
  dams,
  nowIso,
}: {
  dams: DamSummary[];
  nowIso: string;
}) {
  const attention = dams
    .map((dam) => {
      const levelM = dam.latest?.levelM ?? null;
      return { dam, status: deriveDamStatus(levelM, dam.thresholds), levelM };
    })
    .filter(({ status }) => status.tier === "critical" || status.tier === "warning")
    .sort(
      (a, b) =>
        tierRank(a.status.tier) -
          tierRank(b.status.tier) +
          (b.levelM ?? 0) -
          (a.levelM ?? 0),
    );

  if (attention.length === 0) {
    return (
      <div className="mt-8 rounded-lg border border-terrain-700/25 bg-terrain-wash p-4">
        <p className="text-sm font-medium text-terrain-700">
          No dam is currently at or above a documented threshold level.
        </p>
        <p className="mt-1 text-xs leading-5 text-terrain-700/80">
          Based on published thresholds for dams with numeric values; verified
          against the latest readings.
        </p>
      </div>
    );
  }

  return (
    <section aria-labelledby="attention-heading" className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2
          id="attention-heading"
          className="text-2xl font-semibold tracking-tight text-ink"
        >
          Needs attention
        </h2>
        <p className="text-xs text-ink-meta">
          At or past a published threshold · verified readings
        </p>
      </div>
      <ul className="mt-3 overflow-hidden rounded-lg border border-hairline bg-card">
        {attention.slice(0, 5).map(({ dam, status, levelM }) => {
          const latest = dam.latest;
          const stale = latest === null ? false : isStaleReading(latest.observedAt, nowIso);
          return (
            <li key={dam.id}>
              <Link
                href={`/dams/${dam.id}`}
                className="flex flex-col gap-2 border-b border-hairline p-3.5 transition-colors last:border-0 hover:bg-mist focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:relative focus-visible:outline-none md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-3">
                  <DamStatusBadge status={status} variant="described" />
                  <span className="font-medium text-water-600 underline-offset-4 hover:underline">
                    {dam.name}
                  </span>
                </div>
                <div className="flex items-center gap-4 md:gap-6">
                  <span className="font-mono text-lg font-semibold text-ink tabular-nums">
                    {formatLevel(levelM)}
                  </span>
                  <span className="inline-flex min-w-16 items-center gap-1 font-mono text-xs text-ink-meta tabular-nums">
                    {formatChange(latest?.change24hM ?? null)}
                    <span className="sr-only">in 24 h</span>
                  </span>
                  <span className="min-w-16 font-mono text-xs text-ink-meta tabular-nums">
                    {latest === null ? "—" : formatAge(latest.observedAt, nowIso)}
                    {stale ? " · stale" : latest === null ? "" : " ago"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
