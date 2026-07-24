import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/response";

import { buildInputClues } from "./build-input-clues";

const RESEARCH_RPC_ERROR_MESSAGES: Record<
  string,
  { status: number; code: string; message: string }
> = {
  PT429: {
    status: 429,
    code: "daily_research_limit_reached",
    message: "The daily product-research limit is reached.",
  },
  PT404: { status: 404, code: "item_not_found", message: "Wardrobe item not found." },
  PT422: {
    status: 422,
    code: "insufficient_research_clues",
    message: "Add a brand, label, SKU, barcode, visible text, or another clue first.",
  },
};

export async function handleEnqueueResearch(
  supabase: SupabaseClient,
  userId: string,
  itemId: string,
  userClue: string | null | undefined,
) {
  const { data: item, error: itemError } = await supabase
    .from("wardrobe_items")
    .select(
      "id, brand, product_name, model_number, barcode, category, color_names, visible_text, notes",
    )
    .eq("id", itemId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (itemError) throw itemError;
  if (!item) throw new ApiError(404, "item_not_found", "Wardrobe item not found.");

  const inputClues = buildInputClues(item, userClue);

  const { data, error } = await supabase.rpc("enqueue_research_run", {
    p_item_id: itemId,
    p_input_clues: inputClues,
  });
  const mapped = error ? RESEARCH_RPC_ERROR_MESSAGES[error.code] : undefined;
  if (mapped) throw new ApiError(mapped.status, mapped.code, mapped.message);
  if (error) throw error;
  return data;
}
