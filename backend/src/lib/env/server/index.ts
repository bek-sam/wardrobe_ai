import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());

const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());

const optionalPositiveInteger = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(fallback));

// Feature flags are opt-in: anything that is not an explicit truthy string
// leaves the flag off, so a typo or an unset variable fails closed.
const booleanFlag = z.preprocess(
  (value) =>
    typeof value === "string" ? ["true", "1", "yes", "on"].includes(value.trim()) : false,
  z.boolean().default(false),
);

// Signing/HMAC secrets must be long enough that an offline guess is
// impractical. `openssl rand -hex 32` produces a 64-character value.
const optionalSecret = z.preprocess(emptyToUndefined, z.string().min(32).optional());

export const serverEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  SUPABASE_URL: optionalUrl,
  SUPABASE_PUBLISHABLE_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
  AI_ORCHESTRATION_URL: optionalUrl,
  AI_SERVICE_TOKEN: optionalSecret,
  OPEN_METEO_FORECAST_URL: z.url().default("https://api.open-meteo.com/v1/forecast"),
  OPEN_METEO_GEOCODING_URL: z.url().default("https://geocoding-api.open-meteo.com/v1/search"),
  WEATHER_CACHE_TTL_SECONDS: optionalPositiveInteger(900),
  WARDROBE_ORIGINALS_BUCKET: z.string().default("wardrobe-originals"),
  WARDROBE_ITEMS_BUCKET: z.string().default("wardrobe-items"),
  WARDROBE_LABELS_BUCKET: z.string().default("wardrobe-labels"),
  WARDROBE_GENERATED_BUCKET: z.string().default("wardrobe-generated"),
  PROFILE_REFERENCES_BUCKET: z.string().default("profile-references"),
  SIGNED_URL_TTL_SECONDS: optionalPositiveInteger(300),
  DAILY_IMAGE_LIMIT: optionalPositiveInteger(20),
  DAILY_STYLIST_LIMIT: optionalPositiveInteger(40),
  DAILY_PLANNER_LIMIT: optionalPositiveInteger(10),
  STYLIST_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(5),
  PLANNER_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(2),
  // Deterministic wardrobe lookups and insights spend no daily generation
  // budget, so their only ceiling is this rolling abuse limit.
  WARDROBE_QUERY_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(20),
  // Bounds how often ambiguous text may escalate to the classifier model.
  INTENT_CLASSIFICATION_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(10),
  IMAGE_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(3),

  // ---------------------------------------------------------------------
  // Outfit Studio / AI try-on visualizations.
  // ---------------------------------------------------------------------
  // The paid try-on budget is deliberately NOT here: request_outfit_
  // visualization() is callable by `authenticated`, so its daily limit lives
  // in feature_limits and its queue/rate caps are constants inside the
  // function. An env-driven limit would have to be passed in as an argument,
  // which a client could then supply itself.
  //
  // Identity-photo confirmation runs a paid vision call, so it is budgeted
  // like every other model-backed route rather than being free to replay.
  IDENTITY_ASSESSMENT_DAILY_LIMIT: optionalPositiveInteger(10),
  IDENTITY_ASSESSMENT_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(3),
  VISUALIZATION_DOWNLOAD_RATE_LIMIT_PER_MINUTE: optionalPositiveInteger(20),

  // ---------------------------------------------------------------------
  // Authentication. Provider secrets (Google client secret, Turnstile secret,
  // SMTP credentials) deliberately live in Supabase/Google/SMTP configuration
  // and never in this application's environment. See docs/authentication.md.
  // ---------------------------------------------------------------------
  PUBLIC_SIGNUP_ENABLED: booleanFlag,
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: booleanFlag,
  NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED: booleanFlag,
  NEXT_PUBLIC_CAPTCHA_ENABLED: booleanFlag,
  // Site key only. The matching Turnstile *secret* belongs in Supabase's
  // CAPTCHA configuration, which is what actually validates the token.
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: optionalString,
  // HMAC key for one-time auth action challenges (password reset, deletion
  // reauthentication). Generate with: openssl rand -hex 32
  AUTH_ACTION_SECRET: optionalSecret,
  // HMAC key that turns emails/IPs into opaque pre-auth rate-limit buckets so
  // the limiter never stores a raw identifier. Generate with: openssl rand -hex 32
  AUTH_RATE_LIMIT_HMAC_SECRET: optionalSecret,
  // Name of the client-IP header the deployment's reverse proxy *overwrites*.
  // Unset means "no trustworthy client IP", which downgrades IP buckets to a
  // shared unknown-proxy bucket rather than trusting a spoofable header.
  TRUSTED_CLIENT_IP_HEADER: optionalString,
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
