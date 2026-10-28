import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DamReadingsTable } from "@/components/dams/dam-readings-table";
import {
  FreshnessChip,
  DamStatusBadge,
} from "@/components/dams/dam-status-badge";
import { WaterLevelChart } from "@/components/dams/water-level-chart";
import { ThresholdIndicator } from "@/components/dams/threshold-indicator";
import {
  formatAge,
  formatChange,
  formatLevel,
  formatObservedAt,
  isStaleReading,
} from "@/components/dams/format";
import {
  deriveDamStatus,
  numericThresholds,
} from "@/components/dams/status";
import { createPublicDamsService } from "@/features/dams";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Dam detail",
};

/*
 * Dam detail page. The params promise is awaited inside the Suspense
 * boundary so unknown dam ids still get an App Shell (ISR with Cache
 * Components); the data read is request-time via `connection()`.
 */
export default function DamPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-6 pt-6">
        <Suspense fallback={<DamDetailFallback />}>
          <DamDetail damId={params} />
        </Suspense>
        
        <p className="mt-3 text-xs leading-5 text-ink-meta">
          Values as recorded by the Tubig API (PAGASA dam observations), stored
          verbatim; missing measurements are shown as dashes. Timestamps render
          in PHT.
        </p>
      </div>
    </main>
  );
}

async function DamDetail({ damId }: { damId: Promise<{ id: string }> }) {
  const { id } = await damId;
  // Request-time read: defer past prerendering (see app/page.tsx).
  await connection();
  const service = createPublicDamsService();
  const dam = await service.getDamDetail(id);
  if (dam === null) {
    notFound();
  }
  const latest = dam.readings[0] ?? null;
  const nowIso = new Date().toISOString();
  const stale =
    latest === null ? false : isStaleReading(latest.observedAt, nowIso);
  const marks = numericThresholds(dam.thresholds);

  return (
    <article className="pb-16">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-meta">
        <Link
          href="/"
          className="font-medium text-water-600 underline-offset-4 hover:underline"
        >
          All dams
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink-body">{dam.name}</span>
      </nav>

      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
        {dam.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-ink-meta tabular-nums">
        dam id: {dam.id}
        {dam.updatedAt === null ? "" : ` · record updated ${formatObservedAt(dam.updatedAt)}`}
      </p>

      {latest === null ? (
        <div className="mt-6 rounded-lg border border-dashed border-hairline bg-mist p-8">
          <h2 className="text-lg font-semibold text-ink">
            No reading recorded yet
          </h2>
          <p className="mt-1 text-sm text-ink-body">
            This dam&apos;s first reading appears after the next successful
            synchronization run. Thresholds below are still shown as published.
          </p>
        </div>
      ) : (
        <section
          aria-label="Latest reading"
          className="mt-6 overflow-hidden rounded-xl border border-hairline bg-card"
        >
          <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto] md:items-start md:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <DamStatusBadge
                  status={deriveDamStatus(latest.levelM, dam.thresholds)}
                  variant="described"
                />
                <FreshnessChip
                  agePhrase={formatAge(latest.observedAt, nowIso)}
                  stale={stale}
                />
              </div>
              <dl className="mt-4">
                <dt className="text-xs font-semibold tracking-wide text-ink-meta uppercase">
                  Current water level
                </dt>
                <dd className="mt-1.5 font-mono text-5xl font-semibold text-ink tabular-nums md:text-6xl">
                  {formatLevel(latest.levelM)}
                  <span className="ml-1.5 align-baseline font-sans text-lg font-medium text-ink-meta md:text-xl">
                    m
                  </span>
                </dd>
              </dl>
              <p className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:max-w-md md:grid-cols-2">
                <span className="text-ink-meta">
                  24h change{" "}
                  <span className="font-mono font-semibold text-ink tabular-nums">
                    {formatChange(latest.change24hM)}
                  </span>
                </span>
                <span className="text-ink-meta">
                  Rule curve{" "}
                  <span className="font-mono font-semibold text-ink tabular-nums">
                    {formatLevel(latest.ruleCurveM)}
                  </span>
                </span>
                <span className="text-ink-meta">
                  Normal high{" "}
                  <span className="font-mono font-semibold text-ink tabular-nums">
                    {formatLevel(latest.normalHighM)}
                  </span>
                </span>
                <span className="text-ink-meta">
                  Source{" "}
                  <span className="font-semibold text-ink">
                    {latest.source ?? "—"}
                  </span>
                </span>
              </p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-5 text-sm md:min-w-72",
                stale ? "border-amber-700/30 bg-amber-wash" : "bg-mist border-hairline",
              )}
            >
              <p className="text-xs font-semibold tracking-wide text-ink-meta uppercase">
                Observed
              </p>
              <p className={cn("mt-1.5 font-mono text-base font-medium tabular-nums", stale ? "text-amber-800" : "text-ink")}>
                {formatObservedAt(latest.observedAt)}
              </p>
              <p className="mt-3 text-xs leading-5 text-ink-body">
                {stale
                  ? "Stale: this reading has missed a daily sync cycle. Treat the values above with caution until the next run."
                  : "Within one sync cycle of the daily 11:00 PHT refresh."}
              </p>
            </div>
          </div>
        </section>
      )}

      <section
        aria-labelledby="history-heading"
        className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]"
      >
        <div className="min-w-0">
          <div className="flex items-baseline justify-between">
            <h2
              id="history-heading"
              className="text-2xl font-semibold tracking-tight text-ink"
            >
              Recent water levels
            </h2>
            <p className="text-xs text-ink-meta">last {dam.readings.length} readings · PHT</p>
          </div>
          <div className="mt-4 rounded-xl border border-hairline bg-card p-4">
            <WaterLevelChart readings={dam.readings} thresholds={dam.thresholds} />
          </div>
        </div>

        <aside aria-labelledby="thresholds-heading">
          <div className="flex items-center gap-1.5">
            <h2
              id="thresholds-heading"
              className="text-2xl font-semibold tracking-tight text-ink"
            >
              Thresholds
            </h2>
            {marks.length > 0 && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="rounded-sm p-0.5 text-ink-faint transition-colors hover:text-ink-meta focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      aria-label="How monitoring status is derived"
                    >
                      <Info className="size-4" aria-hidden />
                    </button>
                  }
                />
                <TooltipContent className="max-w-72">
                  Status tiers are computed by this application by comparing
                  the level against each published numeric threshold (Critical,
                  Warning, Watch; Low when below the smallest). Not an
                  official operational declaration.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="mt-4 rounded-xl border border-hairline bg-card p-5">
            <ThresholdIndicator
              levelM={latest?.levelM ?? null}
              thresholds={dam.thresholds}
            />
            <dl className="mt-4 divide-y divide-hairline">
              {marks.length === 0 ? (
                <p className="text-sm text-ink-body leading-relaxed">
                  No numeric thresholds published for this dam (its status
                  shows as &ldquo;Not classified&rdquo;).
                </p>
              ) : (
                marks.map((mark) => (
                  <div key={mark.key} className="flex justify-between py-2">
                    <dt className="text-sm text-ink-body capitalize">{mark.key.replace(/_/g, " ")}</dt>
                    <dd className="font-mono text-sm font-semibold text-ink tabular-nums">
                      {formatLevel(mark.levelM)}
                    </dd>
                  </div>
                ))
              )}
            </dl>
          </div>
        </aside>
      </section>

      <section aria-labelledby="table-heading" className="mt-10">
        <h2 id="table-heading" className="text-2xl font-semibold tracking-tight text-ink">
          Reading history
        </h2>
        <div className="mt-4">
          <DamReadingsTable dam={dam} />
        </div>
      </section>
    </article>
  );
}

function DamDetailFallback() {
  return (
    <div aria-hidden>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="mt-4 h-10 w-80" />
      <Skeleton className="mt-2 h-4 w-64" />
      <Skeleton className="mt-6 h-56 w-full rounded-xl" />
      <div className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    </div>
  );
}
