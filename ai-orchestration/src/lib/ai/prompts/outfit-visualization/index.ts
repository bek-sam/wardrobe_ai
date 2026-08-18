import type { VisualizationGarmentInput } from "@/lib/ai/visualization-provider/contracts";
import { OUTFIT_VISUALIZATION_PROMPT_VERSION } from "@/lib/visualization";

/**
 * Quality-gate instructions. Explicitly forbids the sensitive inferences the
 * product's non-goals rule out: the assessor reports on *garments and framing*,
 * never on the person's body, weight, age, ethnicity, or attractiveness.
 */
export const VISUALIZATION_ASSESSMENT_PROMPT = `You are an automated fidelity checker for a private wardrobe try-on preview.

You are given the generated image, the identity reference photo it was based on, and the exact catalog record for every garment that was supplied. Report only what you can actually see.

Judge:
- identity.recognizableMatch: does the generated person plausibly read as the same individual as the reference photo? Use "uncertain" when you genuinely cannot tell.
- framing: exactly one person, whole body visible, head visible, shoes visible.
- anatomy: obviously wrong hands, limbs, or joints. Minor softness is not a failure.
- garments: for each supplied item ID, whether it is present and how faithfully its color, pattern, silhouette, construction, closure, and distinctive details were reproduced.
- extraGarments: short names of any major garment visible that was NOT supplied.
- verdict: "pass" when the image is usable, "correctable" when a targeted regeneration could plausibly fix it, "fail" when it is unusable.
- correctionInstructions: concrete, specific fixes only. No generic styling advice.
- safeSummary: one short user-facing sentence.

Never describe or infer the person's body shape, body type, weight, height, fitness, attractiveness, gender identity, ethnicity, age, or health. Never comment on how the clothing fits their body. Report only garment fidelity and framing.`;

const ROLE_LABELS: Record<VisualizationGarmentInput["role"], string> = {
  top: "top",
  bottom: "bottom",
  dress: "dress",
  layer: "outer layer",
  shoes: "shoes",
  accessory: "accessory",
};

/**
 * One line per garment, tying an explicit image number to exactly one role and
 * the confirmed wardrobe facts for that item. Item IDs stay out of the prompt
 * text — the server keeps the imageNumber -> itemId mapping for QA instead.
 */
export function describeGarmentInput(garment: VisualizationGarmentInput): string {
  const colors = garment.colorNames.length
    ? garment.colorNames.join(" and ")
    : "the exact colors shown";
  const pattern =
    garment.pattern && garment.pattern.toLowerCase() !== "solid"
      ? `, ${garment.pattern} pattern`
      : "";
  const fit = garment.fit ? `, ${garment.fit} fit` : "";
  const silhouette = garment.silhouette ? `, ${garment.silhouette} silhouette` : "";
  const materials = garment.materials.length ? `, ${garment.materials.join("/")}` : "";
  return `- Image ${garment.imageNumber} is the ${ROLE_LABELS[garment.role]}: ${colors}${pattern}${fit}${silhouette}${materials}.`;
}

/**
 * Fixed rule block for the try-on prompt. Kept as data next to the versioned
 * builder so a wording change is a reviewable diff that must be paired with a
 * prompt-version bump (the version is an input to the freshness hash).
 */
export const VISUALIZATION_PROMPT_RULES = `Rules:
- Image 1 is the identity reference. Take the person's face, hair, skin tone, body proportions, and general appearance from it, and nothing else. It supplies no clothing.
- Preserve the person's recognizable identity exactly. Do not beautify, slim, widen, lengthen, age, or otherwise reshape them.
- Render exactly one person, full body, head through shoes, in portrait framing. Do not crop the head or the feet.
- Use only the garments supplied above, each in the role its image is mapped to. Do not substitute, add, or omit a garment.
- Do not add any jacket, coat, bag, belt, scarf, hat, jewelry, or footwear that was not supplied.
- Preserve for every garment: dominant and secondary colors, pattern placement and scale, silhouette, garment length, neckline or collar, sleeve length and volume, rise and leg shape, closure and whether it is open or closed, texture, sheen, and distinctive construction details.
- Reproduce visible logos or text only where they can be rendered accurately. Never invent text, labels, or branding.
- Layer the garments in a physically logical order, with the outer layer over the top and the top's hem related sensibly to the bottom.
- Use a natural, neutral, editorial standing pose with arms slightly away from the torso so every garment region stays visible. Do not let the hands cover important garment features.
- Use a simple warm-neutral studio background with clean separation between the person and the background, and even natural lighting.
- This is a style visualization, not a fit simulation. Do not attempt to depict physical fit, tailoring, or sizing accuracy.`;

/**
 * Versioned builder, never a mutable inline string: the version it is paired
 * with (OUTFIT_VISUALIZATION_PROMPT_VERSION) is an input to the freshness
 * hash, so any wording change here must be shipped with a version bump or old
 * images would be wrongly reused.
 */
export function buildOutfitVisualizationPrompt(
  garments: readonly VisualizationGarmentInput[],
  correctionInstructions: readonly string[] = [],
): string {
  const listing = [...garments]
    .sort((first, second) => first.imageNumber - second.imageNumber)
    .map(describeGarmentInput)
    .join("\n");

  const correction = correctionInstructions.length
    ? `\n\nA previous attempt was rejected by an automated fidelity check. Fix exactly these problems while keeping every rule above:\n${correctionInstructions
        .map((instruction) => `- ${instruction}`)
        .join("\n")}`
    : "";

  return `Dress the person from the identity reference in exactly the garments supplied below, for a private wardrobe styling preview.

${listing}

${VISUALIZATION_PROMPT_RULES}${correction}`;
}

export { OUTFIT_VISUALIZATION_PROMPT_VERSION };

/**
 * Identity-photo suitability check. The forbidden-inference paragraph is the
 * important half: this model looks at a photo of a real person, and the
 * product's non-goals rule out body-shape, weight, age, ethnicity, health, and
 * attractiveness inferences absolutely.
 */
export const IDENTITY_REFERENCE_PROMPT = `You check whether a photo is usable as a rendering reference for a private wardrobe try-on preview.

Report only:
- personCount: how many people are prominently visible.
- fullBody: "yes" if head through feet are visible, "partial" if some of the body is cut off, "no" if it is a head-and-shoulders or similar crop.
- faceVisible: whether the face is visible and unobstructed enough to be recognizable.
- occlusion: how much of the person is hidden by objects, other people, or heavy shadow.
- lighting: whether the lighting is even enough to reproduce.
- framing: whether the person is framed and angled usably (front or slight three-quarter, arms not flat against the torso).
- verdict: "pass" when the photo is usable, "warn" when it is usable but a retake would help, "fail" when it cannot be used at all.
- userMessage: one short, kind, practical sentence. If the verdict is not "pass", say specifically what to change in a retake.

Return "fail" when there is no person, more than one prominent person, the face is not visible, or the image is unusable.

Never describe or infer the person's body shape, body type, weight, height, build, fitness, attractiveness, gender identity, ethnicity, race, age, or health. Never comment on their appearance beyond whether the photo is technically usable. Your userMessage must be about the photograph, never about the person.`;

/**
 * Localization only identifies *where* a garment is in the frame. It never
 * becomes a source of garment facts — every displayed detail is read from the
 * owned wardrobe row instead.
 */
export const VISUALIZATION_LOCALIZATION_PROMPT = `You locate garments inside a generated wardrobe try-on image so the interface can make them tappable.

For each supplied item ID, return one bounding region covering the visible extent of that garment in the generated image.

Rules:
- Coordinates are normalized to the range 0 to 1, measured from the top-left corner of the image. x/y are the region's top-left corner; width/height are its size.
- Return one region per supplied item ID that is actually visible. Omit an item you cannot see rather than guessing a region for it.
- Never return a region for a garment that was not supplied.
- Overlapping regions are expected and correct: an open coat overlaps the top beneath it. Return the visible extent of each garment separately.
- confidence reflects how certain you are of the region's extent, not of the garment's identity.
- Do not describe, name, or infer any property of the garments or the person. Return geometry only.`;
