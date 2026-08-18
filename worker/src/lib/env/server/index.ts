import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(32).optional());
const positiveInteger = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(fallback));
const optionalPositiveInteger = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

/**
 * Worker-only configuration. Provider keys and model names deliberately do not
 * exist here; AI work crosses the authenticated private HTTP boundary.
 */
export const serverEnvironmentSchema = z.object({
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AI_ORCHESTRATION_URL: optionalUrl,
  AI_SERVICE_TOKEN: optionalSecret,
  AI_CATALOG_POLICY_VERSION: z.string().default("catalog@v1"),
  AI_RESEARCH_POLICY_VERSION: z.string().default("research@v1"),
  AI_CURATOR_POLICY_VERSION: z.string().default("curator@v1"),
  AI_IMAGE_POLICY_VERSION: z.string().default("image@v1"),

  OPEN_METEO_FORECAST_URL: z.url().default("https://api.open-meteo.com/v1/forecast"),
  OPEN_METEO_GEOCODING_URL: z.url().default("https://geocoding-api.open-meteo.com/v1/search"),
  WEATHER_CACHE_TTL_SECONDS: positiveInteger(900),

  WARDROBE_ORIGINALS_BUCKET: z.string().default("wardrobe-originals"),
  WARDROBE_ITEMS_BUCKET: z.string().default("wardrobe-items"),
  WARDROBE_LABELS_BUCKET: z.string().default("wardrobe-labels"),
  WARDROBE_GENERATED_BUCKET: z.string().default("wardrobe-generated"),
  PROFILE_REFERENCES_BUCKET: z.string().default("profile-references"),
  SIGNED_URL_TTL_SECONDS: positiveInteger(300),

  WARDROBE_COMPILATION_MAX_CANDIDATES: optionalPositiveInteger,
  WARDROBE_COMPILATION_MAX_FOUNDATIONS_PER_BUCKET: optionalPositiveInteger,
  WARDROBE_CURATOR_MAX_CANDIDATES: positiveInteger(40),
  WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION: positiveInteger(2),
  WARDROBE_CURATOR_MAX_SELECTED_PER_NEW_ITEM: positiveInteger(5),
  DAILY_CURATOR_CALL_LIMIT: positiveInteger(20),
  OUTFIT_ANALYSIS_CACHE_TTL_DAYS: positiveInteger(90),

  PREVIEW_MAX_AUTO_PER_UPLOAD: positiveInteger(5),
  PREVIEW_DAILY_LIMIT: positiveInteger(30),
  PREVIEW_MAX_QUEUED_PER_USER: positiveInteger(5),
  PREVIEW_FREQUENTLY_SUGGESTED_THRESHOLD: positiveInteger(3),

  WORKER_CONCURRENCY: positiveInteger(2),
  WORKER_ENABLED_FAMILIES: optionalString,
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env);
  return cachedEnvironment;
}

export function requireEnvironment<K extends keyof ServerEnvironment>(
  ...keys: K[]
): ServerEnvironment & Required<Pick<ServerEnvironment, K>> {
  const environment = getServerEnvironment();
  const missing = keys.filter((key) => !environment[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required worker configuration: ${missing.join(", ")}`);
  }
  return environment as ServerEnvironment & Required<Pick<ServerEnvironment, K>>;
}
