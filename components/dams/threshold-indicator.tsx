import { formatLevel } from "./format";
import { numericThresholds } from "./status";
import type { DamThresholds } from "@/types/database";
import { cn } from "@/lib/utils";

/**
 * ThresholdIndicator (DESIGN.md §Data visualization): a horizontal
 * "elevation ladder" over the dam's own documented scale. Marks fall at
 * every published numeric threshold (labelled with the source key verbatim);
 * the diamond marks the measured level. Rendered server-side as inline SVG —
 * no interactivity is implied beyond the accessible text summary.
 *
 * Range rules: the scale spans only values that actually exist (thresholds +
 * measured level) with padding, so an unpublished dam shows nothing rather
 * than a fabricated 0-to-max scale.
 */

const WIDTH = 560;
const HEIGHT = 92;
const PAD_LEFT = 64;
const PAD_RIGHT = 64;
const PAD_TOP = 26;
const PAD_BOTTOM = 34;

function xScale(min: number, max: number, value: number): number {
  if (max === min) return PAD_LEFT + (WIDTH - PAD_LEFT - PAD_RIGHT) / 2;
  const fraction = (value - min) / (max - min);
  return PAD_LEFT + fraction * (WIDTH - PAD_LEFT - PAD_RIGHT);
}

function niceBounds(min: number, max: number): [number, number] {
  const pad = Math.max((max - min) * 0.08, 0.01);
  return [min - pad, max + pad];
}

export function ThresholdIndicator({
  levelM,
  thresholds,
  className,
}: {
  levelM: number | null;
  thresholds: DamThresholds;
  className?: string;
}) {
  const marks = numericThresholds(thresholds);
  const points = [...marks.map((mark) => mark.levelM)];
  if (levelM !== null) points.push(levelM);

  if (marks.length === 0 && levelM === null) {
    return (
      <p className={cn("text-sm text-ink-meta", className)}>
        No published thresholds or current level — nothing to scale.
      </p>
    );
  }

  const [min, max] = niceBounds(Math.min(...points), Math.max(...points));
  const levelX = levelM === null ? null : xScale(min, max, levelM);
  const summary = [
    levelM === null
      ? "no current reading"
      : `measured level ${formatLevel(levelM)}`,
    ...marks.map((mark) => `${mark.key} ${formatLevel(mark.levelM)}`),
  ].join(", ");

  return (
    <figure className={cn("m-0", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Elevation scale: ${summary}.`}
      >
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={HEIGHT - PAD_BOTTOM}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="#b9c8d2"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Scale end labels */}
        <text
          x={PAD_LEFT}
          y={HEIGHT - PAD_BOTTOM + 16}
          textAnchor="middle"
          fontSize="10"
          fill="#5a7086"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {levelFormatterMargin(min)}
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - PAD_BOTTOM + 16}
          textAnchor="middle"
          fontSize="10"
          fill="#5a7086"
          fontFamily="var(--font-geist-mono), monospace"
        >
          {levelFormatterMargin(max)}
        </text>

        {marks.map((mark) => {
          const x = xScale(min, max, mark.levelM);
          return (
            <g key={mark.key}>
              <line
                x1={x}
                x2={x}
                y1={HEIGHT - PAD_BOTTOM - 6}
                y2={HEIGHT - PAD_BOTTOM + 6}
                stroke="#8ba0b3"
                strokeWidth="1.5"
              />
              <text
                x={x}
                y={HEIGHT - PAD_BOTTOM + 22}
                textAnchor="middle"
                fontSize="9.5"
                fill="#5a7086"
              >
                {mark.key.replace(/_/g, " ")}
              </text>
              <text
                x={x}
                y={PAD_TOP - 8}
                textAnchor="middle"
                fontSize="9.5"
                fill="#5a7086"
                fontFamily="var(--font-geist-mono), monospace"
              >
                {mark.levelM.toFixed(2)}
              </text>
            </g>
          );
        })}

        {levelX !== null && (
          <g>
            <line
              x1={levelX}
              x2={levelX}
              y1={14}
              y2={HEIGHT - PAD_BOTTOM + 6}
              stroke="#2177bd"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
            <path
              d={`M ${levelX} ${HEIGHT - PAD_BOTTOM} l -5 -9 l 10 0 Z`}
              fill="#2177bd"
            />
            <text
              x={levelX}
              y={10}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#1664a4"
              fontFamily="var(--font-geist-mono), monospace"
            >
              {formatLevel(levelM)}
            </text>
          </g>
        )}
      </svg>
      <figcaption className="sr-only">{`Elevation scale: ${summary}.`}</figcaption>
    </figure>
  );
}

function levelFormatterMargin(value: number): string {
  const formatter = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
}

/**
 * Compact level bar for directory rows: the measured level's position inside
 * the span of published thresholds. Two marks only (min & max span); a dash
 * is shown when either side is missing.
 */
export function MiniLevelBar({
  levelM,
  thresholds,
  className,
}: {
  levelM: number | null;
  thresholds: DamThresholds;
  className?: string;
}) {
  const marks = numericThresholds(thresholds);
  if (levelM === null || marks.length === 0 || levelM === undefined) {
    return (
      <span
        aria-hidden
        className={cn("block h-1 w-16 rounded-full bg-hairline", className)}
      />
    );
  }
  const min = marks[0].levelM;
  const max = marks[marks.length - 1].levelM;
  const fraction =
    max === min
      ? 1
      : Math.min(1, Math.max(0, (levelM - min) / (max - min)));
  const pct = fraction * 100;
  return (
    <span
      className={cn("relative block h-1 w-16 rounded-full bg-hairline", className)}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full bg-water-500"
        style={{ width: `${pct}%` }}
        aria-hidden
      />
      <span
        className="absolute top-1/2 size-[7px] -translate-y-1/2 rounded-full border border-white bg-water-600"
        style={{ left: `calc(${pct}% - 3.5px)` }}
        aria-hidden
      />
    </span>
  );
}
