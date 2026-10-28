"use client";

import * as React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from "@/components/ui/chart";
import type { ChartConfig } from "@/components/ui/chart";
import type { DamReadingView } from "@/features/dams";
import { numericThresholds } from "./status";
import {
  formatLevel,
  formatObservedAt,
  formatShortDate,
} from "./format";
import type { DamThresholds } from "@/types/database";

/**
 * WaterLevelChart (DESIGN.md §Data visualization): the dam's recent reading
 * history as its primary visualization, built on the shadcn chart primitives
 * (recharts). Only stored values are plotted — null readings create breaks
 * (never zeros) via `connectNulls={false}`; published thresholds render as
 * labelled reference lines in the reserved semantic colours. Client-side:
 * receives plain, pre-serialized props from the server page.
 */

interface ChartPoint {
  t: number; // UTC epoch ms
  iso: string;
  level: number | null;
  ruleCurve: number | null;
}

const config: ChartConfig = {
  level: { label: "Water level", color: "#2177bd" },
  ruleCurve: { label: "Rule curve (reference)", color: "#0f766e" },
};

function thresholdColor(key: string): string {
  const lower = key.toLowerCase();
  if (lower.includes("critical")) return "#b42318";
  if (lower.includes("spill")) return "#b45309";
  return "#48708e";
}

export function WaterLevelChart({
  readings,
  thresholds,
  className,
}: {
  readings: DamReadingView[];
  thresholds: DamThresholds;
  className?: string;
}) {
  const points: ChartPoint[] = readings.map((reading) => ({
    t: new Date(reading.observedAt).getTime(),
    iso: reading.observedAt,
    level: reading.levelM,
    ruleCurve: reading.ruleCurveM,
  }));
  const levelPoints = points.filter((point) => point.level !== null);
  const hasRuleCurve = points.some((point) => point.ruleCurve !== null);

  if (levelPoints.length === 0) {
    return (
      <div
        className={
          "flex h-52 items-center justify-center rounded-lg border border-dashed border-hairline bg-mist text-sm text-ink-meta " +
          (className ?? "")
        }
      >
        No recorded water levels yet — the chart appears after the next sync.
      </div>
    );
  }

  const thresholdMarks = numericThresholds(thresholds);
  const values = [
    ...levelPoints.map((point) => point.level as number),
    ...thresholdMarks.map((mark) => mark.levelM),
  ];
  const valueMin = Math.min(...values);
  const valueMax = Math.max(...values);
  const valuePad = Math.max((valueMax - valueMin) * 0.06, 0.01);

  const times = points.map((point) => point.t);
  const singleTime = times.every((time) => time === times[0]);
  const xDomain: [number | string, number | string] = singleTime
    ? [times[0] - 36e6, times[0] + 36e6]
    : ["dataMin", "dataMax"];

  const summary = `Line chart of ${levelPoints.length} recorded readings from ${formatShortDate(
    levelPoints[0].iso,
  )} to ${formatShortDate(levelPoints[levelPoints.length - 1].iso)} (PHT), levels between ${Math.min(
    ...values,
  ).toFixed(2)} and ${valueMax.toFixed(2)} metres.${
    thresholdMarks.length > 0
      ? ` Reference lines mark ${thresholdMarks
          .map((mark) => `${mark.key} at ${formatLevel(mark.levelM)}`)
          .join(", ")}.`
      : ""
  }`;

  return (
    <figure className={"m-0 " + (className ?? "")}>
      <ChartContainer config={config} className="!aspect-auto h-64 md:h-80">
        <LineChart
          data={points}
          margin={{ top: 8, right: 12, bottom: 0, left: 4 }}
        >
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={xDomain}
            tickLine={false}
            axisLine={{ stroke: "#d8e1e8" }}
            tick={{ fontSize: 10, fill: "#5a7086" }}
            tickFormatter={(value) =>
              formatShortDate(new Date(value as number).toISOString())
            }
            minTickGap={40}
          />
          <YAxis
            domain={[valueMin - valuePad, valueMax + valuePad]}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 10, fill: "#5a7086" }}
            tickFormatter={(value) =>
              new Intl.NumberFormat("en-PH", { maximumFractionDigits: 2 }).format(
                value as number,
              )
            }
          />
          <ChartTooltip
            cursor={{ stroke: "#b9c8d2" }}
            content={<LevelTooltip />}
          />
          {hasRuleCurve && (
            <Line
              dataKey="ruleCurve"
              type="monotone"
              stroke="var(--color-ruleCurve)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
              name="ruleCurve"
            />
          )}
          <Line
            dataKey="level"
            type="monotone"
            stroke="var(--color-level)"
            strokeWidth={2}
            dot={levelPoints.length <= 12 || undefined}
            connectNulls={false}
            isAnimationActive={false}
            name="level"
          />
          {thresholdMarks.map((mark) => (
            <ReferenceLine
              key={mark.key}
              y={mark.levelM}
              stroke={thresholdColor(mark.key)}
              strokeDasharray="5 4"
              strokeWidth={1.25}
              label={{
                value: `${mark.key} · ${formatLevel(mark.levelM)}`,
                position: "insideTopRight",
                fontSize: 10,
                fill: thresholdColor(mark.key),
                fontWeight: 600,
              }}
            />
          ))}
        </LineChart>
      </ChartContainer>
      <ChartLegend content={<ChartLegendContent />} />
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

interface LevelTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}

/** Tooltip: PHT timestamp label, mono values, colour dots per series. */
function LevelTooltip({ active, payload }: LevelTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const rows: Array<{ name: string; value: number | null; color: string }> = [
    { name: "Water level", value: point.level, color: "var(--color-level)" },
  ];
  if (point.ruleCurve !== null) {
    rows.push({
      name: "Rule curve",
      value: point.ruleCurve,
      color: "var(--color-ruleCurve)",
    });
  }
  return (
    <div className="grid min-w-36 gap-1 rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs shadow-xl">
      <p className="font-medium text-ink">{formatObservedAt(point.iso)}</p>
      {rows.map((row) => (
        <p
          key={row.name}
          className="flex items-center justify-between gap-4 leading-none"
        >
          <span className="inline-flex items-center gap-1.5 text-ink-meta">
            <span
              aria-hidden
              className="inline-block size-2 rounded-[2px]"
              style={{ backgroundColor: row.color }}
            />
            {row.name}
          </span>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {row.value === null ? "—" : `${formatLevel(row.value)}`}
          </span>
        </p>
      ))}
    </div>
  );
}
