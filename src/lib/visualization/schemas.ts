import { z } from "zod";

import { OUTFIT_ITEM_ROLES } from "@/features/outfits/types";

import { VISUALIZATION_SOURCE_KINDS, VISUALIZATION_STATUSES } from "./constants.data";

const normalizedUnit = z.number().min(0).max(1);
const role = z.enum(OUTFIT_ITEM_ROLES);

export const normalizedRectSchema = z
  .object({
    x: normalizedUnit,
    y: normalizedUnit,
    width: z.number().gt(0).max(1),
    height: z.number().gt(0).max(1),
  })
  .strict()
  .refine((value) => value.x + value.width <= 1.0001, "The region extends past the right edge.")
  .refine((value) => value.y + value.height <= 1.0001, "The region extends past the bottom edge.");

export const normalizedPointSchema = z.object({ x: normalizedUnit, y: normalizedUnit }).strict();

export const hotspotSourceSchema = z.enum(["model", "fallback", "user_corrected"]);

export const garmentHotspotSchema = z.discriminatedUnion("version", [
  z
    .object({
      version: z.literal(1),
      itemId: z.string().uuid(),
      role,
      shape: z.literal("rect"),
      bounds: normalizedRectSchema,
      confidence: normalizedUnit,
      source: hotspotSourceSchema,
      zIndex: z.number().int().min(0).max(20),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      itemId: z.string().uuid(),
      role,
      shape: z.literal("polygon"),
      points: z.array(normalizedPointSchema).min(3).max(64),
      confidence: normalizedUnit,
      source: hotspotSourceSchema,
      zIndex: z.number().int().min(0).max(20),
    })
    .strict(),
]);

export const visualizationStatusSchema = z.enum(VISUALIZATION_STATUSES);
export const visualizationSourceKindSchema = z.enum(VISUALIZATION_SOURCE_KINDS);

const verdict = z.enum(["pass", "uncertain", "fail"]);

/**
 * Structured quality gate. Deliberately carries no body-shape, weight, age,
 * ethnicity, attractiveness, or health field: the assessment may only report
 * whether the *rendered garments and framing* are faithful.
 */
export const visualizationAssessmentSchema = z
  .object({
    identity: z.object({ recognizableMatch: verdict, faceVisible: z.boolean() }).strict(),
    framing: z
      .object({
        singlePerson: z.boolean(),
        fullBodyVisible: z.boolean(),
        headVisible: z.boolean(),
        shoesVisible: z.boolean(),
      })
      .strict(),
    anatomy: z
      .object({ verdict, issues: z.array(z.string().trim().min(1).max(160)).max(6) })
      .strict(),
    garments: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            role,
            present: z.boolean(),
            colorFidelity: verdict,
            patternFidelity: verdict,
            silhouetteFidelity: verdict,
            constructionFidelity: verdict,
            closureFidelity: verdict,
            distinctiveDetailFidelity: verdict,
          })
          .strict(),
      )
      .max(8),
    extraGarments: z.array(z.string().trim().min(1).max(80)).max(8),
    verdict: z.enum(["pass", "correctable", "fail"]),
    correctionInstructions: z.array(z.string().trim().min(1).max(240)).max(6),
    safeSummary: z.string().trim().min(1).max(400),
  })
  .strict();

/** Localization runs as its own bounded call after QA accepts the image. */
export const visualizationLocalizationSchema = z
  .object({
    regions: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            role,
            bounds: normalizedRectSchema,
            confidence: normalizedUnit,
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

/**
 * Identity-photo suitability. Reports only what makes a photo usable as a
 * rendering reference — never a body-shape, weight, age, ethnicity, health, or
 * attractiveness judgement, which the product's non-goals forbid outright.
 */
export const identityReferenceAssessmentSchema = z
  .object({
    personCount: z.number().int().min(0).max(20),
    fullBody: z.enum(["yes", "partial", "no"]),
    faceVisible: z.boolean(),
    occlusion: z.enum(["low", "medium", "high"]),
    lighting: z.enum(["good", "usable", "poor"]),
    framing: z.enum(["good", "usable", "poor"]),
    verdict: z.enum(["pass", "warn", "fail"]),
    userMessage: z.string().trim().min(1).max(300),
  })
  .strict();

export const activateIdentityReferenceSchema = z
  .object({
    referenceId: z.string().uuid(),
    /** Explicit action, never a passive link: the box must actually be ticked. */
    consentAccepted: z.literal(true),
  })
  .strict();

export const confirmIdentityUploadSchema = z
  .object({ storagePath: z.string().trim().min(1).max(500) })
  .strict();

export const visualizationFeedbackReasons = [
  "looks_like_me",
  "does_not_look_like_me",
  "wrong_garment",
  "missing_garment",
  "bad_anatomy",
  "styling_not_for_me",
  "other",
] as const;

export const visualizationFeedbackSchema = z
  .object({
    reason: z.enum(visualizationFeedbackReasons),
    comment: z.string().trim().min(1).max(600).nullable().default(null),
  })
  .strict();

export const createVisualizationSchema = z
  .object({
    sourceKind: visualizationSourceKindSchema,
    sourceId: z.string().uuid().nullable().default(null),
    /** Ordered exact item selection, used by `composition` snapshots only. */
    items: z
      .array(
        z
          .object({ item_id: z.string().uuid(), role, sort_order: z.number().int().min(0).max(7) })
          .strict(),
      )
      .min(1)
      .max(6)
      .optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.sourceKind === "composition" ? Boolean(value.items) : Boolean(value.sourceId),
    "A composition requires items; every other source requires a sourceId.",
  );

export type IdentityReferenceAssessment = z.output<typeof identityReferenceAssessmentSchema>;
export type VisualizationAssessment = z.output<typeof visualizationAssessmentSchema>;
export type VisualizationLocalization = z.output<typeof visualizationLocalizationSchema>;
export type VisualizationFeedbackInput = z.output<typeof visualizationFeedbackSchema>;
export type CreateVisualizationInput = z.output<typeof createVisualizationSchema>;
