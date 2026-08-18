import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const environmentSchema = z.object({
  OPENAI_API_KEY: optionalString,
  OPENAI_API_BASE_URL: z.url().default("https://api.openai.com/v1"),
  OPENAI_VISION_MODEL: optionalString,
  OPENAI_STYLIST_MODEL: optionalString,
  OPENAI_PLANNER_MODEL: optionalString,
  OPENAI_RESEARCH_MODEL: optionalString,
  OPENAI_CURATOR_MODEL: optionalString,
  OPENAI_IMAGE_MODEL: optionalString,
  OPENAI_IMAGE_QUALITY: z.enum(["low", "medium", "high"]).default("high"),
  OPENAI_VISUALIZATION_QA_MODEL: optionalString,
  OPENAI_IMAGE_CAPABILITY_PROFILE: z
    .enum(["auto_fidelity", "explicit_high_fidelity"])
    .default("auto_fidelity"),
  OUTFIT_VISUALIZATION_PROVIDER: z.enum(["openai", "fake"]).default("openai"),
  OUTFIT_VISUALIZATION_FAKE_OUTCOME: optionalString,
  AI_SERVICE_TOKEN: z.string().min(32),
});

export type AiEnvironment = z.infer<typeof environmentSchema>;

let cached: AiEnvironment | undefined;

export function getServerEnvironment(): AiEnvironment {
  cached ??= environmentSchema.parse(process.env);
  return cached;
}

export function requireEnvironment<K extends keyof AiEnvironment>(
  ...keys: K[]
): AiEnvironment & Required<Pick<AiEnvironment, K>> {
  const environment = getServerEnvironment();
  const missing = keys.filter((key) => !environment[key]);
  if (missing.length > 0)
    throw new Error(`Missing required AI configuration: ${missing.join(", ")}`);
  return environment as AiEnvironment & Required<Pick<AiEnvironment, K>>;
}
