import type { researchProduct } from "@/lib/ai/agents/research-agent";

export function proposedChanges(result: Awaited<ReturnType<typeof researchProduct>>["result"]) {
  return {
    brand: result.proposedChanges.brand,
    product_name: result.proposedChanges.productName,
    model_number: result.proposedChanges.modelNumber,
    materials: result.proposedChanges.materials,
    care_instructions: result.proposedChanges.careInstructions,
    purchase_price: result.proposedChanges.typicalPrice,
    currency: result.proposedChanges.currency,
    release_line: result.proposedChanges.releaseLine,
  };
}
