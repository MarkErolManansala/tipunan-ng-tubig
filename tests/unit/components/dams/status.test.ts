import { describe, expect, it } from "vitest";
import {
  deriveDamStatus,
  numericThresholds,
  statusPhrase,
  tierRank,
} from "@/components/dams/status";
import type { DamThresholds } from "@/types/database";

/**
 * The application-defined status rule (documented in DESIGN.md). Fixed
 * scenarios model the threshold-key vocabulary observed in the Tubig source:
 * `critical`, `spilling`, `maintaining`, `minimum_operating`, `normal_high`.
 */

const FULL: DamThresholds = {
  critical: 217.0,
  spilling: 216.5,
  maintaining: 214.0,
  minimum_operating: 196.0,
  normal_high: 210.0,
};

describe("numericThresholds", () => {
  it("keeps only numeric values, sorted ascending", () => {
    expect(numericThresholds({ spilling: 216.5, critical: null, low: 196 })).toEqual([
      { key: "low", levelM: 196 },
      { key: "spilling", levelM: 216.5 },
    ]);
  });
  it("returns empty for null values and empty objects", () => {
    expect(numericThresholds({})).toEqual([]);
    expect(numericThresholds({ spilling: null })).toEqual([]);
  });
});

describe("deriveDamStatus — not classified", () => {
  it("is not classified without a level", () => {
    expect(deriveDamStatus(null, FULL)).toEqual({
      tier: null,
      thresholdKey: null,
      approaching: false,
    });
  });
  it("is not classified without numeric thresholds", () => {
    expect(deriveDamStatus(200, { critical: null })).toEqual({
      tier: null,
      thresholdKey: null,
      approaching: false,
    });
    expect(deriveDamStatus(200, {})).toEqual({
      tier: null,
      thresholdKey: null,
      approaching: false,
    });
  });
});

describe("deriveDamStatus — crossings", () => {
  it("critical at or above the critical threshold", () => {
    expect(deriveDamStatus(217.0, FULL)).toEqual({
      tier: "critical",
      thresholdKey: "critical",
      approaching: false,
    });
    expect(deriveDamStatus(220, FULL).tier).toBe("critical");
  });
  it("warning at or above spilling but below critical", () => {
    expect(deriveDamStatus(216.5, FULL)).toEqual({
      tier: "warning",
      thresholdKey: "spilling",
      approaching: false,
    });
  });
  it("watch at or above the highest remaining threshold (normal_high)", () => {
    expect(deriveDamStatus(210.0, FULL)).toEqual({
      tier: "watch",
      thresholdKey: "normal_high",
      approaching: false,
    });
  });
  it("low below the smallest published threshold", () => {
    expect(deriveDamStatus(195, FULL)).toEqual({
      tier: "low",
      thresholdKey: "minimum_operating",
      approaching: false,
    });
  });
  it("normal between the lowest threshold and the watch band", () => {
    const result = deriveDamStatus(200, FULL);
    expect(result.tier).toBe("normal");
    expect(result.thresholdKey).toBeNull();
  });
});

describe("deriveDamStatus — proximity watch (application-defined)", () => {
  it("watches within 2% of the next threshold above the level", () => {
    // spilling 216.5: the 2% window starts at ≈ 212.17. A level of 213.5 sits
    // below every threshold except minimum_operating (196) and, being within
    // the window, reads as approaching spilling.
    const result = deriveDamStatus(213.5, FULL);
    expect(result).toEqual({
      tier: "watch",
      thresholdKey: "spilling",
      approaching: true,
    });
  });
  it("does not watch when clearly below the window and the normal band", () => {
    // 205 is far from spilling (216.5) and inside the normal band
    // (between minimum_operating 196 and normal_high 210).
    expect(deriveDamStatus(205, FULL).tier).toBe("normal");
  });
  it("watches at normal_high even past the proximity window", () => {
    // 211 exceeds normal_high (210) but is too far from spilling for the
    // approach window — the reached rule catches it instead.
    expect(deriveDamStatus(211, FULL)).toEqual({
      tier: "watch",
      thresholdKey: "normal_high",
      approaching: false,
    });
  });
});

describe("deriveDamStatus — restricted vocabularies", () => {
  it("picks the largest *critical* key when several exist", () => {
    expect(deriveDamStatus(206, { critical: 200, high_critical: 205 }).tier).toBe(
      "critical",
    );
    expect(deriveDamStatus(204, { critical: 200, high_critical: 205 }).tier).not.toBe(
      "critical",
    );
  });
  it("falls back to watch at/above the highest threshold for non-standard keys", () => {
    expect(deriveDamStatus(150, { operating: 140, full: 148 })).toEqual({
      tier: "watch",
      thresholdKey: "full",
      approaching: false,
    });
  });
});

describe("presentation helpers", () => {
  it("phrases describe the driving threshold verbatim", () => {
    expect(statusPhrase({ tier: "critical", thresholdKey: "critical", approaching: false })).toBe(
      "Above critical level",
    );
    expect(
      statusPhrase({ tier: "watch", thresholdKey: "spilling", approaching: true }),
    ).toBe("Approaching spilling level");
    expect(statusPhrase({ tier: null, thresholdKey: null, approaching: false })).toBe(
      "Not classified",
    );
  });
  it("ranks attention: critical < warning < watch < low < normal < unclassified", () => {
    expect(tierRank("critical")).toBeLessThan(tierRank("warning"));
    expect(tierRank("warning")).toBeLessThan(tierRank("watch"));
    expect(tierRank("watch")).toBeLessThan(tierRank("low"));
    expect(tierRank("low")).toBeLessThan(tierRank("normal"));
    expect(tierRank("normal")).toBeLessThan(tierRank(null));
  });
});
