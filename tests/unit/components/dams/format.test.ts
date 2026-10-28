import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_HOURS,
  ageHours,
  formatAge,
  formatChange,
  formatLevel,
  isStaleReading,
  formatShortDate,
} from "@/components/dams/format";

/**
 * Display formatting rules: metres with two decimals, signed changes, PHT
 * rendering, and the app-defined staleness rule (> 36 h, one missed daily
 * cycle). "now" is injected for determinism.
 */

const NOW = "2026-10-28T03:00:00.000Z";

describe("measurements", () => {
  it("formats levels with two decimals; null is an em dash, never zero", () => {
    expect(formatLevel(208.94)).toBe("208.94 m");
    expect(formatLevel(null)).toBe("—");
  });
  it("formats changes signed; null is an em dash", () => {
    expect(formatChange(-0.09)).toBe("-0.09 m");
    expect(formatChange(1)).toBe("+1.00 m");
    expect(formatChange(null)).toBe("—");
  });
});

describe("reading age & staleness", () => {
  it("computes floored hours", () => {
    expect(ageHours("2026-10-28T01:30:00.000Z", NOW)).toBe(1);
    expect(ageHours("2026-10-27T03:00:00.000Z", NOW)).toBe(24);
  });
  it("renders compact ages", () => {
    expect(formatAge("2026-10-28T02:30:00.000Z", NOW)).toBe("<1 h");
    expect(formatAge("2026-10-28T01:00:00.000Z", NOW)).toBe("2 h");
    expect(formatAge("2026-10-25T03:00:00.000Z", NOW)).toBe("3 d");
  });
  it("marks stale after the documented threshold", () => {
    expect(STALE_AFTER_HOURS).toBe(36);
    expect(isStaleReading("2026-10-26T12:00:00.000Z", NOW)).toBe(true);
    expect(isStaleReading("2026-10-27T12:00:00.000Z", NOW)).toBe(false);
  });
});

describe("PHT rendering", () => {
  it("renders the short date in Asia/Manila", () => {
    // 2026-10-28T20:00:00Z is 2026-10-29 04:00 PHT (en-PH: "Oct 29").
    expect(formatShortDate("2026-10-28T20:00:00.000Z")).toBe("Oct 29");
  });
});
