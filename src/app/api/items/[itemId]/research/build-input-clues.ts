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

export function buildInputClues(item: ItemClueRow, userClue: string | null | undefined) {
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
