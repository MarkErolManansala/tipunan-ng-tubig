import { CircleAlert, Minus, TriangleAlert } from "lucide-react";
import type { DamStatus } from "./status";
import { statusPhrase } from "./status";
import { cn } from "@/lib/utils";

/**
 * DamStatusBadge (DESIGN.md §Status): the application-defined monitoring
 * tier rendered as a wash chip with an icon so the state does not rely on
 * colour alone. The phrase names the driving threshold verbatim; the
 * surrounding page must additionally label the classification as
 * application-defined ("computed from published thresholds" footnote).
 */

const TIER_PRESENTATION = {
  critical: {
    label: "Critical",
    icon: CircleAlert,
    className:
      "bg-critical-wash text-critical-700 border-critical-500/40",
  },
  warning: {
    label: "Warning",
    icon: TriangleAlert,
    className: "bg-amber-wash text-amber-800 border-amber-700/40",
  },
  watch: {
    label: "Watch",
    icon: TriangleAlert,
    className: "bg-amber-wash text-amber-800 border-amber-700/25",
  },
  normal: {
    label: "Normal",
    icon: Minus,
    className:
      "bg-terrain-wash text-terrain-700 border-terrain-700/25",
  },
  low: {
    label: "Low",
    icon: Minus,
    className: "bg-teal-wash text-teal-700 border-teal-700/25",
  },
} as const;

export function DamStatusBadge({
  status,
  variant = "chip",
  className,
}: {
  status: DamStatus;
  /** "chip": icon + tier label. "described": icon + tier + threshold phrase. */
  variant?: "chip" | "described";
  className?: string;
}) {
  if (status.tier === null) {
    return (
      <span
        className={cn(
          "inline-flex h-5 w-fit items-center gap-1 rounded-4xl border border-hairline bg-mist px-2 text-xs font-medium text-ink-meta",
          className,
        )}
      >
        Not classified
      </span>
    );
  }
  const presentation = TIER_PRESENTATION[status.tier];
  const Icon = presentation.icon;
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-4xl border px-2 text-xs font-medium",
        presentation.className,
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {variant === "described"
        ? statusPhrase(status)
        : presentation.label}
    </span>
  );
}

/**
 * Stale-data chip (DESIGN.md §Stale data): amber only when the reading has
 * genuinely missed a sync cycle (age > recorded rule), otherwise neutral.
 */
export function FreshnessChip({
  agePhrase,
  stale,
  className,
}: {
  agePhrase: string;
  stale: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 w-fit items-center gap-1 rounded-4xl border px-2 text-xs font-medium",
        stale
          ? "border-amber-700/40 bg-amber-wash text-amber-800"
          : "border-hairline bg-mist text-ink-meta",
        className,
      )}
    >
      {stale ? "Stale" : null}
      {`${agePhrase} ago`}
    </span>
  );
}
