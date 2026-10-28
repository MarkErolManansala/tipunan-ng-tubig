"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import type { DamSummary } from "@/features/dams";
import {
  Input,
} from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DamStatusBadge } from "./dam-status-badge";
import { MiniLevelBar } from "./threshold-indicator";
import { deriveDamStatus, tierRank, type DamStatusTier } from "./status";
import { formatAge, formatChange, formatLevel, isStaleReading } from "./format";
import { cn } from "@/lib/utils";

/**
 * DamDirectory (DESIGN.md §Directory): search, sort, and status filter over
 * the verified dam list. The dam set is small (tens, not thousands), so the
 * filter runs client-side over already-fetched data; the page streams once.
 * Desktop renders a comparison table; mobile renders stacked cards that
 * prioritize the level and status.
 */

type StatusFilter = "all" | "attention" | "watch" | "normal" | "unclassified";
type SortKey = "name" | "attention" | "level-desc" | "level-asc" | "change-desc";

interface DirectoryRow {
  dam: DamSummary;
  tier: DamStatusTier | null;
  levelM: number | null;
  change24hM: number | null;
  agePhrase: string | null;
  stale: boolean;
}

function buildRows(
  dams: DamSummary[],
  nowIso: string,
): DirectoryRow[] {
  return dams.map((dam) => {
    const levelM = dam.latest?.levelM ?? null;
    return {
      dam,
      tier: deriveDamStatus(levelM, dam.thresholds).tier,
      levelM,
      change24hM: dam.latest?.change24hM ?? null,
      agePhrase:
        dam.latest === null ? null : formatAge(dam.latest.observedAt, nowIso),
      stale:
        dam.latest === null
          ? false
          : isStaleReading(dam.latest.observedAt, nowIso),
    };
  });
}

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all", label: "All dams" },
  { key: "attention", label: "Needs attention" },
  { key: "watch", label: "Watch" },
  { key: "normal", label: "Normal" },
  { key: "unclassified", label: "Unclassified" },
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Dam name" },
  { key: "attention", label: "Attention first" },
  { key: "level-desc", label: "Level: high to low" },
  { key: "level-asc", label: "Level: low to high" },
  { key: "change-desc", label: "24h rise first" },
];

function tierPassesFilter(tier: DamStatusTier | null, filter: StatusFilter) {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return tier === "critical" || tier === "warning";
    case "watch":
      return tier === "watch";
    case "normal":
      return tier === "normal" || tier === "low";
    case "unclassified":
      return tier === null;
  }
}

function ChangeCell({ change24hM }: { change24hM: number | null }) {
  if (change24hM === null) return <span className="text-ink-meta">—</span>;
  const Icon = change24hM > 0 ? ArrowUpRight : change24hM < 0 ? ArrowDownRight : null;
  const direction = change24hM > 0 ? "rose" : change24hM < 0 ? "fell" : "held";
  return (
    <span className="inline-flex items-center gap-1 font-mono tabular-nums">
      {Icon !== null && (
        <Icon className="size-3.5 text-ink-meta" aria-hidden />
      )}
      <span>
        {formatChange(change24hM)}
        <span className="sr-only">{` in 24 hours (${direction})`}</span>
      </span>
    </span>
  );
}

export function DamDirectory({
  dams,
  nowIso,
}: {
  dams: DamSummary[];
  nowIso: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("name");

  const allRows = useMemo(() => buildRows(dams, nowIso), [dams, nowIso]);

  const rows = useMemo(() => {
    const filtered = allRows.filter((row) => {
      const nameMatch = row.dam.name
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      return nameMatch && tierPassesFilter(row.tier, statusFilter);
    });
    return filtered.sort((a, b) => {
      switch (sort) {
        case "name":
          return a.dam.name.localeCompare(b.dam.name);
        case "attention":
          return (
            tierRank(a.tier) - tierRank(b.tier) ||
            (b.levelM ?? -Infinity) - (a.levelM ?? -Infinity)
          );
        case "level-desc":
          return (b.levelM ?? -Infinity) - (a.levelM ?? -Infinity);
        case "level-asc":
          return (a.levelM ?? Infinity) - (b.levelM ?? Infinity);
        case "change-desc":
          return (b.change24hM ?? -Infinity) - (a.change24hM ?? -Infinity);
      }
    });
  }, [allRows, query, statusFilter, sort]);

  if (dams.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-mist p-10 text-center">
        <h2 className="text-lg font-semibold text-ink">No dam data yet</h2>
        <p className="mt-1 text-sm text-ink-body">
          Readings appear after the first synchronization run completes.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-faint"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dam name…"
            aria-label="Search dams by name"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Filter by monitoring status"
            className="flex flex-wrap items-center gap-1.5"
          >
            {STATUS_FILTERS.map((filter) => {
              const isActive = statusFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(filter.key)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs font-medium transition-colors",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    isActive
                      ? "border-water-600 bg-water-wash text-water-600"
                      : "border-hairline bg-transparent text-ink-meta hover:border-rule hover:text-ink-body",
                  )}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
            <SelectTrigger
              aria-label="Sort dams"
              className="w-44 shrink-0 bg-card"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-hairline bg-mist p-10 text-center text-sm text-ink-meta">
          No dams match &ldquo;{query.trim()}&rdquo; with this status filter.
        </div>
      ) : (
        <>
          {/* Desktop comparison table */}
          <div className="mt-4 hidden rounded-lg border border-hairline bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="py-2.5 pr-3 pl-4 text-xs font-semibold tracking-wide text-ink-meta uppercase">
                    Dam
                  </TableHead>
                  <TableHead className="py-2.5 pr-3 text-xs font-semibold tracking-wide text-ink-meta uppercase">
                    Status
                  </TableHead>
                  <TableHead className="py-2.5 pr-3 text-right text-xs font-semibold tracking-wide text-ink-meta uppercase">
                    Current level
                  </TableHead>
                  <TableHead className="py-2.5 pr-3 text-right text-xs font-semibold tracking-wide text-ink-meta uppercase">
                    24h change
                  </TableHead>
                  <TableHead className="py-2.5 pr-3 text-right text-xs font-semibold tracking-wide text-ink-meta uppercase">
                    Reading age
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.dam.id}>
                    <TableCell className="py-2.5 pr-3 pl-4">
                      <Link
                        href={`/dams/${row.dam.id}`}
                        className="font-medium text-water-600 underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                      >
                        {row.dam.name}
                      </Link>
                    </TableCell>
                    <TableCell className="py-2.5 pr-3">
                      <DamStatusBadge status={deriveDamStatus(row.levelM, row.dam.thresholds)} />
                    </TableCell>
                    <TableCell className="py-2.5 pr-3 text-right">
                      <span className="inline-flex items-center justify-end gap-2">
                        <MiniLevelBar
                          levelM={row.levelM}
                          thresholds={row.dam.thresholds}
                        />
                        <span className="min-w-20 font-mono font-medium text-ink tabular-nums">
                          {formatLevel(row.levelM)}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="py-2.5 pr-3 text-right text-ink-body">
                      <ChangeCell change24hM={row.change24hM} />
                    </TableCell>
                    <TableCell className="py-2.5 pr-4 text-right">
                      {row.agePhrase === null ? (
                        <span className="text-ink-meta">—</span>
                      ) : (
                        <span
                          className={cn(
                            "font-mono text-xs tabular-nums",
                            row.stale ? "text-amber-800" : "text-ink-meta",
                          )}
                        >
                          {row.agePhrase}
                          {row.stale ? " · stale" : ""}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile stacked cards, level and status first */}
          <ul className="mt-4 grid gap-2.5 md:hidden">
            {rows.map((row) => (
              <li key={row.dam.id}>
                <Link
                  href={`/dams/${row.dam.id}`}
                  className="block rounded-lg border border-hairline bg-card p-5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-semibold text-ink">
                      {row.dam.name}
                    </h3>
                    <DamStatusBadge
                      status={deriveDamStatus(row.levelM, row.dam.thresholds)}
                    />
                  </div>
                  <p className="mt-3 font-mono text-2xl font-semibold text-ink tabular-nums">
                    {formatLevel(row.levelM)}
                  </p>
                  <div className="mt-2 flex items-center gap-2 text-sm text-ink-body">
                    <ChangeCell change24hM={row.change24hM} />
                    <span aria-hidden>·</span>
                    <MinWait row={row} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function MinWait({ row }: { row: DirectoryRow }) {
  if (row.agePhrase === null) {
    return (
      <span>
        No reading yet
      </span>
    );
  }
  return (
    <span>
      {row.agePhrase}
      {row.stale ? " · stale" : " ago"}
    </span>
  );
}

/** Loading skeleton for the Suspense boundary. */
export function DamDirectoryFallback() {
  return (
    <div aria-hidden className="mt-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Skeleton className="h-8 w-full md:max-w-xs" />
        <Skeleton className="h-8 w-44" />
      </div>
      <div className="mt-4 rounded-lg border border-hairline bg-card">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton
            key={i}
            className="h-11 w-full rounded-none border-b border-hairline bg-transparent last:border-0"
          />
        ))}
      </div>
    </div>
  );
}
