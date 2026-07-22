import { NextResponse } from "next/server";
import { researchRequestSchema } from "@/features/research/schemas";
import { ApiError, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type Context = { params: Promise<{ itemId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const [{ itemId }, viewer, supabase] = await Promise.all([
      context.params,
      requireViewer(),
      createClient(),
    ]);
    const { data, error } = await supabase
      .from("item_research_runs")
      .select("*, research_sources(*)")
      .eq("item_id", itemId)
      .eq("user_id", viewer.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
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
    const { data: item, error: itemError } = await supabase
      .from("wardrobe_items")
      .select(
        "id, brand, product_name, model_number, barcode, category, color_names, visible_text, notes",
      )
      .eq("id", itemId)
      .eq("user_id", viewer.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (itemError) throw itemError;
    if (!item) throw new ApiError(404, "item_not_found", "Wardrobe item not found.");
    const inputClues = {
      brand: item.brand,
      productName: item.product_name,
      modelNumber: item.model_number,
      barcode: item.barcode,
      category: item.category,
      colors: item.color_names,
      visibleText: item.visible_text,
      description: [item.notes, input.userClue].filter(Boolean).join("\n") || null,
    };
    const searchable = [
      inputClues.brand,
      inputClues.productName,
      inputClues.modelNumber,
      inputClues.barcode,
      ...inputClues.visibleText,
      input.userClue,
    ].some((value) => typeof value === "string" && value.trim().length > 0);
    if (!searchable) {
      throw new ApiError(
        422,
        "insufficient_research_clues",
        "Add a brand, label, SKU, barcode, visible text, or another clue first.",
      );
    }

    const { data, error } = await supabase.rpc("enqueue_research_run", {
      p_item_id: itemId,
      p_input_clues: inputClues,
    });
    if (error?.code === "PT429") {
      throw new ApiError(
        429,
        "daily_research_limit_reached",
        "The daily product-research limit is reached.",
      );
    }
    if (error?.code === "PT404") {
      throw new ApiError(404, "item_not_found", "Wardrobe item not found.");
    }
    if (error?.code === "PT422") {
      throw new ApiError(
        422,
        "insufficient_research_clues",
        "Add a brand, label, SKU, barcode, visible text, or another clue first.",
      );
    }
    if (error) throw error;
    return NextResponse.json(
      { data },
      { status: 202, headers: { Location: `/api/items/${itemId}/research/${data.id}` } },
    );
  } catch (error) {
    return routeError(error);
  }
}
