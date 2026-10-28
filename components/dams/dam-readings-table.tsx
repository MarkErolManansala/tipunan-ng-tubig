import type { DamDetail } from "@/features/dams";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatChange, formatLevel, formatObservedAt } from "./format";

/**
 * The dam's reading history (DESIGN.md §Detail page): compact metadata table
 * beneath the primary chart, newest first. Nulls render as em dashes — a
 * missing measurement is shown as unknown, never as zero.
 */

const headerCell =
  "py-2.5 text-xs font-semibold tracking-wide text-ink-meta uppercase";
const cell = "py-2.5 text-sm text-ink-body";
const numericCell = `${cell} font-mono tabular-nums text-ink`;

export function DamReadingsTable({ dam }: { dam: DamDetail }) {
  if (dam.readings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-mist p-10 text-center">
        <h2 className="text-lg font-semibold text-ink">No readings yet</h2>
        <p className="mt-1 text-sm text-ink-body">
          This dam has no recorded readings. They appear after the next
          synchronization run.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-card">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={`${headerCell} pr-3 pl-4`}>Observed (PHT)</TableHead>
            <TableHead className={`${headerCell} text-right`}>Level</TableHead>
            <TableHead className={`${headerCell} text-right`}>24h change</TableHead>
            <TableHead className={`${headerCell} text-right`}>Rule curve</TableHead>
            <TableHead className={`${headerCell} text-right`}>Normal high</TableHead>
            <TableHead className={`${headerCell} pr-4`}>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dam.readings.map((reading) => (
            <TableRow key={reading.observedAt}>
              <TableCell className={`${cell} pr-3 pl-4 whitespace-nowrap`}>
                {formatObservedAt(reading.observedAt)}
              </TableCell>
              <TableCell className={`${numericCell} text-right`}>
                {formatLevel(reading.levelM)}
              </TableCell>
              <TableCell className={`${numericCell} text-right`}>
                {formatChange(reading.change24hM)}
              </TableCell>
              <TableCell className={`${numericCell} text-right`}>
                {formatLevel(reading.ruleCurveM)}
              </TableCell>
              <TableCell className={`${numericCell} text-right`}>
                {formatLevel(reading.normalHighM)}
              </TableCell>
              <TableCell className={`${cell} pr-4`}>
                {reading.source ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
