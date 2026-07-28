import { ApiError } from "@/lib/api/response";
import { getServerEnvironment, type ServerEnvironment } from "@/lib/env/server";

/**
 * Model-backed routes fail closed with a typed, user-facing error instead of
 * pretending to succeed. The deterministic item-lookup and insight routes call
 * neither of these, so they keep working with every OpenAI variable unset.
 */
function requireModel(
  key: "OPENAI_STYLIST_MODEL" | "OPENAI_PLANNER_MODEL",
  code: string,
  message: string,
): ServerEnvironment & { OPENAI_API_KEY: string } & Record<typeof key, string> {
  const environment = getServerEnvironment();
  if (!environment.OPENAI_API_KEY || !environment[key]) {
    throw new ApiError(503, code, message);
  }
  return environment as ServerEnvironment & { OPENAI_API_KEY: string } & Record<typeof key, string>;
}

export function requireStylistModel() {
  return requireModel(
    "OPENAI_STYLIST_MODEL",
    "stylist_model_unavailable",
    "Outfit generation is not configured on this server. Wardrobe lookups and insights still work.",
  );
}

export function requirePlannerModel() {
  return requireModel(
    "OPENAI_PLANNER_MODEL",
    "planner_model_unavailable",
    "Planning and packing are not configured on this server. Wardrobe lookups and insights still work.",
  );
}
