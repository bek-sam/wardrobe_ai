import { createClient } from "@/lib/supabase/server";

import { DEFAULT_STYLE_PROFILE } from "./default-style.data";
import { buildFeedbackEvidence } from "./feedback-evidence";

export async function getPreferences(userId: string) {
  const supabase = await createClient();
  const [
    { data: profile, error: profileError },
    { data: style, error: styleError },
    { data: feedbackRows, error: feedbackError },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("style_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("outfit_feedback")
      .select("outfit_id, feedback_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  if (profileError) throw profileError;
  if (styleError) throw styleError;
  if (feedbackError) throw feedbackError;

  const outfitIds = [...new Set((feedbackRows ?? []).map((row) => row.outfit_id as string))];
  const { data: outfitItems, error: outfitItemsError } = outfitIds.length
    ? await supabase
        .from("outfit_items")
        .select("outfit_id, item_id")
        .eq("user_id", userId)
        .in("outfit_id", outfitIds)
    : { data: [], error: null };
  if (outfitItemsError) throw outfitItemsError;

  return {
    profile,
    style: style ?? DEFAULT_STYLE_PROFILE,
    feedback: buildFeedbackEvidence(feedbackRows ?? [], outfitItems ?? []),
  };
}
