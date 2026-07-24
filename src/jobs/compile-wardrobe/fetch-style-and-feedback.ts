import type { AdminClient } from "./types";

export async function fetchStyleAndFeedback(admin: AdminClient, userId: string) {
  const [{ data: style }, { data: feedbackRows }] = await Promise.all([
    admin
      .from("style_profiles")
      .select(
        "favorite_colors, avoided_colors, preferred_fits, style_keywords, style_archetypes, updated_at",
      )
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("outfit_feedback")
      .select("outfit_id, feedback_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const outfitIds = [...new Set((feedbackRows ?? []).map((row) => row.outfit_id as string))];
  const { data: outfitItems } = outfitIds.length
    ? await admin
        .from("outfit_items")
        .select("outfit_id, item_id")
        .eq("user_id", userId)
        .in("outfit_id", outfitIds)
    : { data: [] as { outfit_id: string; item_id: string }[] };

  return { style, feedbackRows: feedbackRows ?? [], outfitItems: outfitItems ?? [] };
}
