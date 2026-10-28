import type { TubigDam, TubigDamList, TubigDamReading } from "@/lib/tubig/schemas";

/**
 * Fixtures shaped after the verified live API responses (2026-10-28).
 * Sources must be attributed: PAGASA dam information.
 */
export const TUBIG_SOURCES: TubigDamList["sources"] = [
  {
    name: "PAGASA, dam information",
    url: "https://pagasa.dost.gov.ph/flood",
    licence: null,
  },
];

export function makeReading(overrides: Partial<TubigDamReading> = {}): TubigDamReading {
  return {
    observed_at: "2026-10-28T00:00:00Z",
    level_m: 208.94,
    rule_curve_m: 196.19,
    normal_high_m: 210.0,
    change_24h_m: -0.09,
    source: "pagasa_dams",
    ...overrides,
  };
}

export function makeDam(overrides: Partial<TubigDam> = {}): TubigDam {
  return {
    id: "angat",
    name: "Angat Dam",
    thresholds: {
      critical: 160.0,
      minimum_operating: 180.0,
      normal_high: 210.0,
      spilling: 217.0,
    },
    latest: makeReading(),
    ...overrides,
  };
}

/** A dam with no thresholds and no latest reading (real case: Ambuklao). */
export function makeMinimalDam(id = "ambuklao"): TubigDam {
  return makeDam({ id, name: "Ambuklao Dam", thresholds: {}, latest: null });
}

export function makeDamList(
  items: TubigDam[],
  next: string | null = null,
): TubigDamList {
  return { items, next, sources: TUBIG_SOURCES };
}

/** The exact `next` value observed from the live readings endpoint. */
export const REAL_NEXT_PATH =
  "/v1/history/dams/angat/readings?limit=3&cursor=WyJkYXRldGltZSIsICIyMDI2LTEwLTI2VDAwOjAwOjAwKzAwOjAwIiwgMjY5XQ";
