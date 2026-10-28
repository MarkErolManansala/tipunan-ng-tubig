import { z } from "zod";

/**
 * Tubig API response schemas (verified against live responses on 2026-10-28).
 * See .agent/skills/tubig-api-sync/SKILL.md before changing any shape here —
 * fields must not be invented, and nullable fields stay nullable.
 */

/** Dam ids are URL slugs: `angat`, `la_mesa`, `san_roque`, … */
export const damIdSchema = z
  .string()
  .regex(/^[a-z0-9_]+$/, "dam id must be a lowercase slug");

const nullableNumber = z.number().nullable();

/** A single water-level observation. Nullable = unknown, never zero. */
export const damReadingSchema = z.object({
  observed_at: z.iso.datetime({ offset: true }),
  level_m: nullableNumber,
  rule_curve_m: nullableNumber,
  normal_high_m: nullableNumber,
  change_24h_m: nullableNumber,
  source: z.string().min(1).nullable(),
});

export const damLatestSchema = damReadingSchema.nullable();

/**
 * Thresholds vary per dam (e.g. `critical`, `spilling`, `maintaining`,
 * `minimum_operating`, `normal_high`) and may be an empty object.
 */
export const damThresholdsSchema = z.record(z.string(), nullableNumber);

export const damSchema = z.object({
  id: damIdSchema,
  name: z.string().min(1),
  thresholds: damThresholdsSchema,
  latest: damLatestSchema,
});

export const tubigSourceSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  licence: z.string().nullable(),
});

export const damListSchema = z.object({
  items: z.array(damSchema),
  next: z.string().nullable(),
  sources: z.array(tubigSourceSchema),
});

export const damReadingsSchema = z.object({
  items: z.array(damReadingSchema),
  next: z.string().nullable(),
  sources: z.array(tubigSourceSchema),
});

export type TubigDam = z.infer<typeof damSchema>;
export type TubigDamReading = z.infer<typeof damReadingSchema>;
export type TubigDamList = z.infer<typeof damListSchema>;
export type TubigDamReadings = z.infer<typeof damReadingsSchema>;
export type TubigSource = z.infer<typeof tubigSourceSchema>;
