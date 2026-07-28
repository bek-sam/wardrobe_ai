import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveWardrobeIntent, type ResolvedIntent } from "@/lib/ai/agents/orchestrator";
import { enforceClassificationQuota, enforceIntentQuota } from "@/lib/usage/intent-quota";

/**
 * The authenticated boundary for a stylist chat turn.
 *
 * The route must be known before the budget can be charged, so intent is
 * resolved here -- once -- and the resolved value is handed to the
 * orchestrator rather than re-classified downstream. Ambiguous text may
 * escalate to at most one classifier model call, gated by its own rolling
 * limit so routing can never be used as an unmetered model endpoint, and never
 * charging a daily generation unit of its own.
 */
export async function resolveChatIntentWithQuota(
  supabase: SupabaseClient,
  input: { userId: string; request: string; date: string },
): Promise<ResolvedIntent> {
  const resolved = await resolveWardrobeIntent(input, () => enforceClassificationQuota(supabase));
  await enforceIntentQuota(supabase, resolved.intent);
  return resolved;
}
