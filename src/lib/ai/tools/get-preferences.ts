import { createClient } from "@/lib/supabase/server";

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
  const itemIdsByOutfit = new Map<string, string[]>();
  for (const row of outfitItems ?? []) {
    const itemIds = itemIdsByOutfit.get(row.outfit_id) ?? [];
    itemIds.push(row.item_id);
    itemIdsByOutfit.set(row.outfit_id, itemIds);
  }
  const likedEvidence = new Map<string, number>();
  const dislikedEvidence = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  for (const row of feedbackRows ?? []) {
    reasonCounts.set(row.feedback_type, (reasonCounts.get(row.feedback_type) ?? 0) + 1);
    const evidence =
      row.feedback_type === "like"
        ? likedEvidence
        : row.feedback_type === "dislike"
          ? dislikedEvidence
          : null;
    if (!evidence) continue;
    for (const itemId of itemIdsByOutfit.get(row.outfit_id) ?? []) {
      evidence.set(itemId, (evidence.get(itemId) ?? 0) + 1);
    }
  }
  const repeatedIds = (evidence: Map<string, number>) =>
    [...evidence].filter(([, count]) => count >= 2).map(([itemId]) => itemId);
  return {
    profile,
    style: style ?? {
      style_keywords: [],
      favorite_colors: [],
      avoided_colors: [],
      preferred_fits: [],
      preferred_formality: null,
      runs_cold: null,
      runs_hot: null,
      modesty_preferences: {},
      size_profile: {},
      common_activities: [],
      notes: "",
    },
    feedback: {
      likedItemIds: repeatedIds(likedEvidence),
      dislikedItemIds: repeatedIds(dislikedEvidence),
      reasonCounts: Object.fromEntries(reasonCounts),
    },
  };
}
