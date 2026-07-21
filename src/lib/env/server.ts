import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const optionalPositiveInteger = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(fallback));

const serverEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  OPENAI_API_BASE_URL: z.url().default("https://api.openai.com/v1"),
  OPENAI_VISION_MODEL: optionalString,
  OPENAI_STYLIST_MODEL: optionalString,
  OPENAI_PLANNER_MODEL: optionalString,
  OPENAI_RESEARCH_MODEL: optionalString,
  OPENAI_IMAGE_MODEL: optionalString,
  OPENAI_IMAGE_QUALITY: z.enum(["low", "medium", "high"]).default("high"),
  OPEN_METEO_FORECAST_URL: z.url().default("https://api.open-meteo.com/v1/forecast"),
  OPEN_METEO_GEOCODING_URL: z.url().default("https://geocoding-api.open-meteo.com/v1/search"),
  WEATHER_CACHE_TTL_SECONDS: optionalPositiveInteger(900),
  WARDROBE_ORIGINALS_BUCKET: z.string().default("wardrobe-originals"),
  WARDROBE_ITEMS_BUCKET: z.string().default("wardrobe-items"),
  WARDROBE_LABELS_BUCKET: z.string().default("wardrobe-labels"),
  WARDROBE_GENERATED_BUCKET: z.string().default("wardrobe-generated"),
  PROFILE_REFERENCES_BUCKET: z.string().default("profile-references"),
  SIGNED_URL_TTL_SECONDS: optionalPositiveInteger(300),
  IMPORT_WORKER_SECRET: optionalString,
  CRON_SECRET: optionalString,
  DAILY_IMAGE_LIMIT: optionalPositiveInteger(20),
  DAILY_STYLIST_LIMIT: optionalPositiveInteger(40),
  DAILY_PLANNER_LIMIT: optionalPositiveInteger(10),
  STYLIST_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(5),
  PLANNER_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(2),
  IMAGE_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(3),
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
    throw new Error(`Missing required server configuration: ${missing.join(", ")}`);
  }

  return environment as ServerEnvironment & Required<Pick<ServerEnvironment, K>>;
}
