import type { DamThresholds } from "@/types/database";

/**
 * Application-defined monitoring status derived from the dam's published,
 * numeric thresholds. The Tubig source supplies numbers keyed per dam
 * (`critical`, `spilling`, `maintaining`, `minimum_operating`, `normal_high` —
 * keys vary per dam and are absent on some dams); it defines no status
 * classification of its own. The tiers below are therefore computed by this
 * application and must be presented as application-defined (DESIGN.md §Status).
 *
 * Rule (documented in DESIGN.md):
 *  - Only numeric thresholds participate; `null` values are ignored.
 *  - critical: level ≥ the largest `*critical*` threshold.
 *  - warning:  level ≥ a `*spill*` threshold (below critical).
 *  - watch:    level ≥ the largest remaining threshold (e.g. `normal_high`,
 *              `maintaining`), or approaching the next-higher threshold within
 *              WATCH_PROXIMITY of its own value (application-defined proximity).
 *  - low:      level < the smallest published threshold (informational).
 *  - normal:   anything else. Dams without numeric thresholds or without a
 *              level are `not classified` — never guessed.
 */

export type DamStatusTier =
  | "critical"
  | "warning"
  | "watch"
  | "normal"
  | "low";

export interface DamStatus {
  tier: DamStatusTier | null;
  /** Verbatim source key of the driving threshold, or null. */
  thresholdKey: string | null;
  /** True only for a proximity-based watch (level below the threshold). */
  approaching: boolean;
}

/**
 * Watch proximity: a level within 2% of the next-higher documented threshold
 * counts as approaching it. Application-defined (DESIGN.md).
 */
export const WATCH_PROXIMITY = 0.02;

export interface NumericThreshold {
  key: string;
  levelM: number;
}

/** The dam's numeric thresholds, ascending. Null values are skipped. */
export function numericThresholds(
  thresholds: DamThresholds,
): NumericThreshold[] {
  return Object.entries(thresholds)
    .filter(([, value]) => typeof value === "number")
    .map(([key, value]) => ({ key, levelM: value as number }))
    .sort((a, b) => a.levelM - b.levelM);
}

function highestMatching(
  thresholds: NumericThreshold[],
  needle: string,
): NumericThreshold | null {
  let match: NumericThreshold | null = null;
  for (const threshold of thresholds) {
    if (
      threshold.key.toLowerCase().includes(needle) &&
      (match === null || threshold.levelM > match.levelM)
    ) {
      match = threshold;
    }
  }
  return match;
}

export function deriveDamStatus(
  levelM: number | null,
  thresholds: DamThresholds,
): DamStatus {
  const notClassified: DamStatus = {
    tier: null,
    thresholdKey: null,
    approaching: false,
  };
  if (levelM === null) return notClassified;
  const numeric = numericThresholds(thresholds);
  if (numeric.length === 0) return notClassified;

  const critical = highestMatching(numeric, "critical");
  if (critical !== null && levelM >= critical.levelM) {
    return { tier: "critical", thresholdKey: critical.key, approaching: false };
  }

  const spilling = highestMatching(numeric, "spill");
  if (spilling !== null && levelM >= spilling.levelM) {
    return { tier: "warning", thresholdKey: spilling.key, approaching: false };
  }

  // Approach watch: close to the nearest safety threshold above the level
  // (critical/spilling) — or, when the dam publishes no safety keys, the
  // nearest threshold above. Application-defined proximity window
  // (WATCH_PROXIMITY, documented in DESIGN.md).
  const hasSafetyKey = numeric.some((threshold) => isSafetyThreshold(threshold.key));
  const candidates = numeric.filter(
    (threshold) =>
      threshold.levelM > levelM &&
      (hasSafetyKey ? isSafetyThreshold(threshold.key) : true),
  );
  const nearestAbove = candidates.reduce<NumericThreshold | null>(
    (nearest, threshold) =>
      nearest === null || threshold.levelM < nearest.levelM ? threshold : nearest,
    null,
  );
  if (
    nearestAbove !== null &&
    nearestAbove.levelM > 0 &&
    (nearestAbove.levelM - levelM) / nearestAbove.levelM <= WATCH_PROXIMITY
  ) {
    return { tier: "watch", thresholdKey: nearestAbove.key, approaching: true };
  }

  // Reached watch: at or above a remaining threshold (maintaining,
  // normal_high, …) except the published floor of the normal band.
  const remaining = numeric.filter((threshold) => !isSafetyThreshold(threshold.key));
  const reached = getNonLowRemaining(remaining).find(
    (threshold) => levelM >= threshold.levelM,
  );
  if (reached !== undefined) {
    return { tier: "watch", thresholdKey: reached.key, approaching: false };
  }

  const lowest = numeric[0];
  if (levelM < lowest.levelM) {
    return { tier: "low", thresholdKey: lowest.key, approaching: false };
  }

  return { tier: "normal", thresholdKey: null, approaching: false };
}

function isSafetyThreshold(key: string): boolean {
  const lower = key.toLowerCase();
  return lower.includes("critical") || lower.includes("spill");
}

/**
 * Remaining thresholds a level can be "reached" against: all non-safety
 * thresholds except the smallest, which marks the floor of the normal band
 * (below it is "low"; above it the band reads normal). With a single
 * remaining threshold it becomes the watch bound itself.
 */
function getNonLowRemaining(remaining: NumericThreshold[]): NumericThreshold[] {
  if (remaining.length <= 1) return remaining;
  return remaining.slice(1);
}

/** Short human phrase for a status tier + driving threshold key. */
export function statusPhrase(status: DamStatus): string {
  switch (status.tier) {
    case "critical":
      return `Above ${status.thresholdKey} level`;
    case "warning":
      return `At or above ${status.thresholdKey} level`;
    case "watch":
      return status.approaching
        ? `Approaching ${status.thresholdKey} level`
        : `At or above ${status.thresholdKey} level`;
    case "low":
      return `Below ${status.thresholdKey} level`;
    case "normal":
      return "Within monitored range";
    case null:
      return "Not classified";
  }
}

/** Sort tier for "needs attention" ranking: null lands last. */
export function tierRank(tier: DamStatusTier | null): number {
  switch (tier) {
    case "critical":
      return 0;
    case "warning":
      return 1;
    case "watch":
      return 2;
    case "low":
      return 3;
    case "normal":
      return 4;
    case null:
      return 5;
  }
}
