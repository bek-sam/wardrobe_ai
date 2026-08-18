import { NextResponse } from "next/server";

import { researchRequestSchema } from "@/features/research/schemas";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/response";

type ItemClueRow = {
  brand: string | null;
  product_name: string | null;
  model_number: string | null;
  barcode: string | null;
  category: string | null;
  color_names: string[];
  visible_text: string[];
  notes: string | null;
};

function buildInputClues(item: ItemClueRow, userClue: string | null | undefined) {
  const inputClues = {
    brand: item.brand,
    productName: item.product_name,
    modelNumber: item.model_number,
    barcode: item.barcode,
    category: item.category,
    colors: item.color_names,
    visibleText: item.visible_text,
    description: [item.notes, userClue].filter(Boolean).join("\n") || null,
  };

  const searchable = [
    inputClues.brand,
    inputClues.productName,
    inputClues.modelNumber,
    inputClues.barcode,
    ...inputClues.visibleText,
    userClue,
  ].some((value) => typeof value === "string" && value.trim().length > 0);
  if (!searchable) {
    throw new ApiError(
      422,
      "insufficient_research_clues",
      "Add a brand, label, SKU, barcode, visible text, or another clue first.",
    );
  }

  return inputClues;
}

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

async function handleEnqueueResearch(
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

async function handleGetResearchRuns(supabase: SupabaseClient, userId: string, itemId: string) {
  const { data, error } = await supabase
    .from("item_research_runs")
    .select("*, research_sources(*)")
    .eq("item_id", itemId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

type Context = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const [{ itemId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const data = await handleGetResearchRuns(supabase, viewer.id, itemId);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [{ itemId }, viewer, input, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      parseJson(request, researchRequestSchema),
      createClient(),
    ]);
    const data = await handleEnqueueResearch(supabase, viewer.id, itemId, input.userClue);
    return NextResponse.json(
      { data },
      { status: 202, headers: { Location: `/api/items/${itemId}/research/${data.id}` } },
    );
  } catch (error) {
    return routeError(error);
  }
}
