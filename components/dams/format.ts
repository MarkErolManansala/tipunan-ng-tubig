/**
 * Display formatting for dam measurements, ages, and timestamps. Values are
 * shown in metres; timestamps render in Philippine time (PHT, Asia/Manila)
 * since the stored values are UTC instants.
 *
 * Formatters are module-level constants and take an explicit `nowIso` where
 * clock-derived output would otherwise be nondeterministic: rendering a
 * stored value through them at a fixed instant is deterministic, which keeps
 * pages prerenderable.
 */

const METERS = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

const levelFormatter = new Intl.NumberFormat("en-PH", METERS);

const changeFormatter = new Intl.NumberFormat("en-PH", {
  ...METERS,
  signDisplay: "exceptZero",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

const shortDateFormatter = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  day: "numeric",
  month: "short",
});

/** Metre measurement, or an em dash when unknown (null is never zero). */
export function formatLevel(m: number | null): string {
  return m === null ? "—" : `${levelFormatter.format(m)} m`;
}

/** Signed 24-hour change in metres, or an em dash when unknown. */
export function formatChange(m: number | null): string {
  return m === null ? "—" : `${changeFormatter.format(m)} m`;
}

/** UTC instant rendered as a PHT date and time. */
export function formatObservedAt(iso: string): string {
  return `${dateTimeFormatter.format(new Date(iso))} PHT`;
}

/** UTC instant rendered as a short PHT date ("28 Oct") for chart axes. */
export function formatShortDate(iso: string): string {
  return shortDateFormatter.format(new Date(iso));
}

/**
 * Whole hours between the reading and the given now (floored). Negative when
 * the reading is in the future relative to `now` — displayed as "<1 h".
 */
export function ageHours(iso: string, nowIso: string): number {
  return Math.floor(
    (new Date(nowIso).getTime() - new Date(iso).getTime()) / 3_600_000,
  );
}

/** Compact age phrase: "<1 h", "5 h", "3 d". */
export function formatAge(iso: string, nowIso: string): string {
  const hours = ageHours(iso, nowIso);
  if (hours < 1) return "<1 h";
  if (hours < 48) return `${hours} h`;
  return `${Math.floor(hours / 24)} d`;
}

/**
 * Staleness rule (application-defined, documented in DESIGN.md): with a daily
 * 03:00 UTC sync, a reading older than 36 hours has missed a cycle and reads
 * as stale on the interface.
 */
export const STALE_AFTER_HOURS = 36;

export function isStaleReading(iso: string, nowIso: string): boolean {
  return ageHours(iso, nowIso) > STALE_AFTER_HOURS;
}
