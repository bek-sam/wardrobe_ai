import { toFile } from "openai";
import type { ImageCapabilityProfile } from "./contracts";
import { VisualizationProviderError } from "./contracts";
import type { GenerateVisualizationInput } from "./contracts";
import type { VisualizationErrorCode } from "./contracts";
import { FALLBACK_BODY_ZONES, type VisualizationLocalization } from "@/lib/visualization";
import type { OutfitVisualizationProvider } from "./contracts";
import sharp from "sharp";
import { sha256Hex } from "@/lib/visualization/server";
import type { GeneratedVisualizationImage } from "./contracts";
import type { VisualizationAssessment } from "@/lib/visualization";
import type { VisualizationGarmentInput } from "./contracts";
import { zodTextFormat } from "openai/helpers/zod";
import { getOpenAIClient } from "@/lib/ai/client";
import { VISUALIZATION_ASSESSMENT_PROMPT } from "@/lib/ai/prompts/outfit-visualization";
import { requireEnvironment } from "@/lib/env/server";
import { visualizationAssessmentSchema } from "@/lib/visualization";
import type { AssessVisualizationInput } from "./contracts";
import { buildOutfitVisualizationPrompt } from "@/lib/ai/prompts/outfit-visualization";
import { VISUALIZATION_LOCALIZATION_PROMPT } from "@/lib/ai/prompts/outfit-visualization";
import { visualizationLocalizationSchema } from "@/lib/visualization";
import type { LocalizeVisualizationInput } from "./contracts";
import { IDENTITY_REFERENCE_PROMPT } from "@/lib/ai/prompts/outfit-visualization";
import {
  identityReferenceAssessmentSchema,
  type IdentityReferenceAssessment,
} from "@/lib/visualization";
import type { AssessIdentityInput } from "./contracts";
import { getServerEnvironment } from "@/lib/env/server";
import { IMAGE_CAPABILITY_PROFILE_TABLE } from "./contracts";

export {
  IMAGE_CAPABILITY_PROFILE_TABLE,
  IMAGE_CAPABILITY_PROFILES,
  type ImageCapabilityProfile,
  type ImageCapabilityProfileName,
} from "./contracts";

export {
  isRetryableVisualizationError,
  VISUALIZATION_ERROR_CODES,
  VisualizationProviderError,
  type VisualizationErrorCode,
} from "./contracts";

export type {
  AssessVisualizationInput,
  GenerateVisualizationInput,
  GeneratedVisualizationImage,
  LocalizeVisualizationInput,
  OutfitVisualizationProvider,
  VisualizationGarmentInput,
} from "./contracts";

/**
 * Builds the provider payload from the capability profile, so only parameters
 * the configured model actually supports are sent. `input_fidelity` in
 * particular is omitted entirely for profiles whose models apply it
 * automatically and reject it as an unknown parameter.
 *
 * Image 1 is always the identity reference; garments follow in imageNumber
 * order, which is the same order the prompt maps to roles.
 */
export async function buildImageEditRequest(
  input: GenerateVisualizationInput,
  capability: ImageCapabilityProfile,
  model: string,
  prompt: string,
) {
  const garments = [...input.garments].sort(
    (first, second) => first.imageNumber - second.imageNumber,
  );
  if (garments.length + 1 > capability.maxImageInputs) {
    throw new VisualizationProviderError(
      "unsupported_capability",
      "This outfit has more pieces than the configured image model can render at once.",
    );
  }

  const identityFile = await toFile(input.identity, "identity-reference.png", {
    type: "image/png",
  });
  const garmentFiles = await Promise.all(
    garments.map((garment) =>
      toFile(garment.cutout, `garment-${garment.imageNumber}.png`, { type: "image/png" }),
    ),
  );

  return {
    model,
    image: [identityFile, ...garmentFiles],
    prompt,
    size: capability.portraitSize,
    output_format: capability.outputFormat,
    background: capability.background,
    user: input.userId,
    stream: false as const,
    ...(capability.sendInputFidelity ? { input_fidelity: "high" as const } : {}),
  };
}

/** HTTP status -> bounded code + safe, user-facing summary. */
const ERROR_STATUS_SIGNATURES: ReadonlyArray<[number, VisualizationErrorCode, string]> = [
  [401, "authentication", "The image provider rejected the configured credentials."],
  [403, "authentication", "The image provider denied access to this model."],
  [429, "rate_limited", "The image provider is rate limiting requests right now."],
];

/** Message shape -> bounded code, for providers that only signal in text. */
const ERROR_MESSAGE_SIGNATURES: ReadonlyArray<[RegExp, VisualizationErrorCode, string]> = [
  [
    /moderation|safety system|content[_ ]policy|flagged/i,
    "moderation_blocked",
    "The provider's safety system blocked this request. Try a different reference photo.",
  ],
  [
    /unsupported|unknown parameter|not supported|invalid[_ ]?value.*fidelity/i,
    "unsupported_capability",
    "The configured image model does not support the requested parameters.",
  ],
  [/timeout|timed out|ETIMEDOUT|ECONNRESET|aborted/i, "timeout", "The image provider timed out."],
  [
    /invalid[_ ]request|invalid image|could not be decoded|unsupported image/i,
    "input_validation",
    "The provider could not use one of the supplied images.",
  ],
];

function safeRequestId(error: unknown): string | null {
  const requestId = (error as { requestID?: unknown })?.requestID;
  return typeof requestId === "string" ? requestId : null;
}

function statusOf(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  return typeof status === "number" ? status : null;
}

/**
 * Reduces any thrown provider value to a bounded code plus a safe, user-facing
 * summary. Never re-throws the original: SDK errors can carry the full request
 * body, which here means the prompt and the user's private reference photo.
 */
export function normalizeVisualizationProviderError(error: unknown): VisualizationProviderError {
  if (error instanceof VisualizationProviderError) return error;

  const requestId = safeRequestId(error);
  const status = statusOf(error);
  const byStatus = ERROR_STATUS_SIGNATURES.find(([code]) => code === status);
  if (byStatus) return new VisualizationProviderError(byStatus[1], byStatus[2], requestId);

  const message = error instanceof Error ? error.message : String(error);
  const byMessage = ERROR_MESSAGE_SIGNATURES.find(([pattern]) => pattern.test(message));
  if (byMessage) return new VisualizationProviderError(byMessage[1], byMessage[2], requestId);

  if (status !== null && status >= 500) {
    return new VisualizationProviderError(
      "provider_transient",
      "The image provider is temporarily unavailable.",
      requestId,
    );
  }
  return new VisualizationProviderError(
    "unknown",
    "The try-on could not be generated right now.",
    requestId,
  );
}

const FAKE_OUTCOMES = ["ready", "qa_fail", "transient_once", "moderation"] as const;

type FakeOutcome = (typeof FAKE_OUTCOMES)[number];

function parseFakeOutcome(value: string | undefined): FakeOutcome {
  return FAKE_OUTCOMES.includes(value as FakeOutcome) ? (value as FakeOutcome) : "ready";
}

/**
 * Lets an E2E run drive the fake provider through every terminal and
 * retryable state without a network call. `transient_once` fails the first
 * attempt per process and succeeds afterwards, which is what exercises the
 * retry-then-success path end to end.
 */
function applyScriptedFailure(outcome: FakeOutcome, attempts: Map<string, number>) {
  if (outcome === "moderation") {
    throw new VisualizationProviderError(
      "moderation_blocked",
      "The provider's safety system blocked this request. Try a different reference photo.",
    );
  }
  if (outcome !== "transient_once") return;
  const seen = attempts.get(outcome) ?? 0;
  attempts.set(outcome, seen + 1);
  if (seen === 0) {
    throw new VisualizationProviderError(
      "provider_transient",
      "The image provider is temporarily unavailable.",
    );
  }
}

function buildFakeAssessment(
  garments: readonly VisualizationGarmentInput[],
  outcome: FakeOutcome,
): VisualizationAssessment {
  const failing = outcome === "qa_fail";
  return {
    identity: { recognizableMatch: failing ? "fail" : "pass", faceVisible: !failing },
    framing: {
      singlePerson: true,
      fullBodyVisible: true,
      headVisible: true,
      shoesVisible: garments.some((garment) => garment.role === "shoes"),
    },
    anatomy: { verdict: "pass", issues: [] },
    garments: garments.map((garment) => ({
      itemId: garment.itemId,
      role: garment.role,
      present: true,
      colorFidelity: "pass" as const,
      patternFidelity: "pass" as const,
      silhouetteFidelity: "pass" as const,
      constructionFidelity: "pass" as const,
      closureFidelity: "pass" as const,
      distinctiveDetailFidelity: "pass" as const,
    })),
    extraGarments: [],
    verdict: failing ? "fail" : "pass",
    correctionInstructions: failing ? ["Match the reference photo's face."] : [],
    safeSummary: failing
      ? "The generated person did not match the reference photo."
      : "The generated image matches the supplied garments.",
  };
}

const WIDTH = 1024;

const HEIGHT = 1536;

/**
 * Renders a real, decodable portrait PNG with one solid band per garment, in
 * the same order the OpenAI adapter would map images to roles. Deterministic:
 * identical input produces byte-identical output, so a test can assert on the
 * content hash. Never reachable in production — the factory only returns this
 * provider when OUTFIT_VISUALIZATION_PROVIDER is explicitly set to "fake".
 */
async function renderFakeVisualization(
  input: GenerateVisualizationInput,
): Promise<GeneratedVisualizationImage> {
  const garments = [...input.garments].sort(
    (first, second) => first.imageNumber - second.imageNumber,
  );
  const bandHeight = Math.floor(HEIGHT / Math.max(1, garments.length));
  const bands = garments.map((garment, index) => ({
    input: {
      create: {
        width: WIDTH,
        height: index === garments.length - 1 ? HEIGHT - bandHeight * index : bandHeight,
        channels: 4 as const,
        background: { r: 40 + index * 30, g: 60 + index * 20, b: 90 + index * 10, alpha: 1 },
      },
    },
    top: bandHeight * index,
    left: 0,
  }));

  const bytes = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 4, background: "#f4f0e8" },
  })
    .composite(bands)
    .png({ compressionLevel: 9 })
    .toBuffer();

  return {
    bytes,
    mimeType: "image/png",
    width: WIDTH,
    height: HEIGHT,
    sha256: sha256Hex(bytes),
    requestId: "fake-request",
  };
}

/**
 * Deterministic, network-free provider for development and automated tests.
 * Produces a real decodable portrait PNG and typed QA/localization results so
 * every pipeline state can be exercised without an OpenAI key or a paid call.
 */
export function createFakeVisualizationProvider(
  capability: ImageCapabilityProfile,
  outcomeSetting: string | undefined,
): OutfitVisualizationProvider {
  const outcome: FakeOutcome = parseFakeOutcome(outcomeSetting);
  const attempts = new Map<string, number>();

  return {
    name: "fake",
    capability,
    modelKey: `fake-visualization-${outcome}`,
    async generate(input) {
      applyScriptedFailure(outcome, attempts);
      return renderFakeVisualization(input);
    },
    async assess(input) {
      return buildFakeAssessment(input.garments, outcome);
    },
    async assessIdentity() {
      return {
        personCount: 1,
        fullBody: "yes" as const,
        faceVisible: true,
        occlusion: "low" as const,
        lighting: "good" as const,
        framing: "good" as const,
        verdict: "pass" as const,
        userMessage: "This photo works well as a reference.",
      };
    },
    async localize(input): Promise<VisualizationLocalization> {
      return {
        regions: input.garments.map((garment) => ({
          itemId: garment.itemId,
          role: garment.role,
          bounds: FALLBACK_BODY_ZONES[garment.role],
          confidence: 0.9,
        })),
      };
    },
  };
}

/** Portrait try-on: reject anything that came back wider than it is tall. */
const MAX_ASPECT_RATIO = 0.95;

/**
 * Decodes what the provider actually returned rather than trusting the
 * declared format: a landscape or corrupt result must fail the pipeline, not
 * reach storage and get served as a ready try-on.
 */
export async function validateGeneratedImage(
  bytes: Buffer,
  requestId: string | null,
): Promise<GeneratedVisualizationImage> {
  if (bytes.byteLength === 0) {
    throw new VisualizationProviderError("invalid_output", "The provider returned no image data.");
  }

  const metadata = await sharp(bytes)
    .metadata()
    .catch(() => null);
  if (!metadata?.width || !metadata.height || metadata.format !== "png") {
    throw new VisualizationProviderError(
      "invalid_output",
      "The provider returned an image that could not be decoded.",
      requestId,
    );
  }
  if (metadata.width / metadata.height > MAX_ASPECT_RATIO) {
    throw new VisualizationProviderError(
      "invalid_output",
      "The provider returned a non-portrait image.",
      requestId,
    );
  }

  return {
    bytes,
    mimeType: "image/png",
    width: metadata.width,
    height: metadata.height,
    sha256: sha256Hex(bytes),
    requestId,
  };
}

/**
 * The exact catalog record the assessor compares the rendered image against.
 * Item IDs are included so the returned per-garment verdicts map back to owned
 * rows — this is server-side context, never user-visible prompt text.
 */
function garmentAssessmentContext(garments: readonly VisualizationGarmentInput[]) {
  return garments.map((garment) => ({
    itemId: garment.itemId,
    role: garment.role,
    imageNumber: garment.imageNumber,
    name: garment.name,
    colorNames: garment.colorNames,
    pattern: garment.pattern,
    fit: garment.fit,
    silhouette: garment.silhouette,
    materials: garment.materials,
  }));
}

function dataUrl(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

async function assessIdentityWithOpenAI(
  input: AssessIdentityInput,
): Promise<IdentityReferenceAssessment> {
  const environment = requireEnvironment("OPENAI_VISUALIZATION_QA_MODEL");
  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_VISUALIZATION_QA_MODEL,
      instructions: IDENTITY_REFERENCE_PROMPT,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Assess this photo's suitability as a reference." },
            { type: "input_image", image_url: dataUrl(input.image), detail: "high" },
          ],
        },
      ],
      text: {
        format: zodTextFormat(identityReferenceAssessmentSchema, "identity_reference_assessment"),
      },
      safety_identifier: input.userId,
      store: false,
    });
    if (!response.output_parsed) {
      throw new VisualizationProviderError(
        "invalid_output",
        "The photo check did not return a usable result.",
      );
    }
    return response.output_parsed;
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}

/**
 * Runs after the QA gate accepts an image. Failure here is never fatal — the
 * caller falls back to deterministic body zones and the chip list, which is
 * why this returns an empty region set rather than throwing on a bad parse.
 */
async function localizeWithOpenAI(
  input: LocalizeVisualizationInput,
): Promise<VisualizationLocalization> {
  const environment = requireEnvironment("OPENAI_VISUALIZATION_QA_MODEL");
  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_VISUALIZATION_QA_MODEL,
      instructions: VISUALIZATION_LOCALIZATION_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Locate each of these garments in the image:\n${JSON.stringify(garmentAssessmentContext(input.garments))}`,
            },
            { type: "input_image", image_url: dataUrl(input.image), detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(visualizationLocalizationSchema, "garment_localization") },
      safety_identifier: input.userId,
      store: false,
    });
    return response.output_parsed ?? { regions: [] };
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}

async function generateWithOpenAI(
  input: GenerateVisualizationInput,
  capability: ImageCapabilityProfile,
  model: string,
): Promise<GeneratedVisualizationImage> {
  const prompt = buildOutfitVisualizationPrompt(input.garments, input.correctionInstructions ?? []);
  const request = await buildImageEditRequest(input, capability, model, prompt);

  try {
    const response = await getOpenAIClient().images.edit(request).withResponse();
    const encoded = response.data.data?.[0]?.b64_json;
    // The one field that lets a "wrong garment" report be correlated with the
    // provider's own logs, so it is captured on success as well as on failure.
    const requestId = response.response.headers.get("x-request-id");
    if (!encoded) {
      throw new VisualizationProviderError(
        "invalid_output",
        "The provider returned no image data.",
        requestId,
      );
    }
    return await validateGeneratedImage(Buffer.from(encoded, "base64"), requestId);
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}

async function assessWithOpenAI(input: AssessVisualizationInput): Promise<VisualizationAssessment> {
  const environment = requireEnvironment("OPENAI_VISUALIZATION_QA_MODEL");
  try {
    const response = await getOpenAIClient().responses.parse({
      model: environment.OPENAI_VISUALIZATION_QA_MODEL,
      instructions: VISUALIZATION_ASSESSMENT_PROMPT,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Supplied garments:\n${JSON.stringify(garmentAssessmentContext(input.garments))}\n\nThe first image is the generated try-on. The second image is the identity reference.`,
            },
            { type: "input_image", image_url: dataUrl(input.image), detail: "high" },
            { type: "input_image", image_url: dataUrl(input.identity), detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(visualizationAssessmentSchema, "visualization_assessment") },
      safety_identifier: input.userId,
      store: false,
    });
    if (!response.output_parsed) {
      throw new VisualizationProviderError(
        "invalid_output",
        "The fidelity check did not return a usable result.",
      );
    }
    return response.output_parsed;
  } catch (error) {
    throw normalizeVisualizationProviderError(error);
  }
}

export function createOpenAIVisualizationProvider(
  capability: ImageCapabilityProfile,
  modelKey: string,
): OutfitVisualizationProvider {
  return {
    name: "openai",
    capability,
    modelKey,
    generate: (input) => generateWithOpenAI(input, capability, modelKey),
    assess: (input) => assessWithOpenAI(input),
    localize: (input) => localizeWithOpenAI(input),
    assessIdentity: (input) => assessIdentityWithOpenAI(input),
  };
}

/**
 * Fails closed: with no image model or QA model configured, the try-on
 * pipeline reports a configuration error rather than silently degrading to the
 * fake provider. The fake is only ever returned when a deployment sets
 * OUTFIT_VISUALIZATION_PROVIDER="fake" explicitly.
 */
export function resolveVisualizationProvider(): OutfitVisualizationProvider {
  const environment = getServerEnvironment();
  const capability = IMAGE_CAPABILITY_PROFILE_TABLE[environment.OPENAI_IMAGE_CAPABILITY_PROFILE];

  if (environment.OUTFIT_VISUALIZATION_PROVIDER === "fake") {
    return createFakeVisualizationProvider(
      capability,
      environment.OUTFIT_VISUALIZATION_FAKE_OUTCOME,
    );
  }

  if (!environment.OPENAI_IMAGE_MODEL || !environment.OPENAI_VISUALIZATION_QA_MODEL) {
    throw new VisualizationProviderError(
      "configuration_missing",
      "AI try-on is not configured on this deployment.",
    );
  }
  const configured = requireEnvironment("OPENAI_IMAGE_MODEL", "OPENAI_VISUALIZATION_QA_MODEL");
  return createOpenAIVisualizationProvider(capability, configured.OPENAI_IMAGE_MODEL);
}

/** True when a try-on can be enqueued at all on this deployment. */
export function isVisualizationConfigured(): boolean {
  const environment = getServerEnvironment();
  if (environment.OUTFIT_VISUALIZATION_PROVIDER === "fake") return true;
  return Boolean(
    environment.OPENAI_API_KEY &&
    environment.OPENAI_IMAGE_MODEL &&
    environment.OPENAI_VISUALIZATION_QA_MODEL,
  );
}
