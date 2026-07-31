import { z } from "zod";

import { IMAGE_CAPABILITY_PROFILES } from "@/lib/ai/visualization-provider/capabilities.data";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);
const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.url().optional());
const optionalPositiveInteger = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(fallback));
const optionalUnboundedPositiveInteger = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);
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
  WARDROBE_COMPILATION_WORKER_SECRET: optionalString,
  WARDROBE_COMPILATION_MAX_CANDIDATES: optionalUnboundedPositiveInteger,
  WARDROBE_COMPILATION_MAX_FOUNDATIONS_PER_BUCKET: optionalUnboundedPositiveInteger,
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
  OPENAI_CURATOR_MODEL: optionalString,
  WARDROBE_CURATOR_MAX_CANDIDATES: optionalPositiveInteger(40),
  WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION: optionalPositiveInteger(2),
  WARDROBE_CURATOR_MAX_SELECTED_PER_NEW_ITEM: optionalPositiveInteger(5),
  DAILY_CURATOR_CALL_LIMIT: optionalPositiveInteger(20),
  OUTFIT_ANALYSIS_CACHE_TTL_DAYS: optionalPositiveInteger(90),
  OUTFIT_PREVIEW_WORKER_SECRET: optionalString,
  PREVIEW_MAX_AUTO_PER_UPLOAD: optionalPositiveInteger(5),
  PREVIEW_DAILY_LIMIT: optionalPositiveInteger(30),
  PREVIEW_MAX_QUEUED_PER_USER: optionalPositiveInteger(5),
  PREVIEW_FREQUENTLY_SUGGESTED_THRESHOLD: optionalPositiveInteger(3),

  // ---------------------------------------------------------------------
  // Outfit Studio / AI try-on visualizations.
  // ---------------------------------------------------------------------
  // Structured vision model that runs the quality gate and hotspot
  // localization. Unset means try-on fails closed with a typed 503 — it never
  // degrades to serving an unchecked image.
  OPENAI_VISUALIZATION_QA_MODEL: optionalString,
  // Capability profile, not a model name: which parameters the configured
  // image model actually accepts. Change only after an authorized
  // non-production smoke test. See docs/outfit-studio.md.
  OPENAI_IMAGE_CAPABILITY_PROFILE: z.enum(IMAGE_CAPABILITY_PROFILES).default("auto_fidelity"),
  // "fake" is a development/test-only deterministic provider. Production must
  // leave this at "openai"; the fake is never a silent fallback.
  OUTFIT_VISUALIZATION_PROVIDER: z.enum(["openai", "fake"]).default("openai"),
  OUTFIT_VISUALIZATION_FAKE_OUTCOME: optionalString,
  OUTFIT_VISUALIZATION_WORKER_SECRET: optionalString,
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
  // Lets an owning user's request process their own queued job inline instead
  // of waiting for a scheduler. Off by default: a long paid image call does
  // not belong in a normal route-handler lifecycle.
  VISUALIZATION_INLINE_PROCESSING_ENABLED: booleanFlag,

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
