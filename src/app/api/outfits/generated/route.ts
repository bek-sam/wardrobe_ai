import { generatedOutfitSchema } from "@/features/outfits/schemas";
import { saveGeneratedOutfitRequestSchema } from "@/features/stylist/schemas";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { createClient } from "@/lib/supabase/server";

type JsonObject = Record<string, unknown>;

function objectValue(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, saveGeneratedOutfitRequestSchema),
      createClient(),
    ]);
    const { data: run, error: runError } = await supabase
      .from("agent_runs")
      .select("id, agent_type, status, output_summary")
      .eq("id", input.generationId)
      .eq("user_id", viewer.id)
      .eq("agent_type", "wardrobe_orchestrator")
      .eq("status", "complete")
      .maybeSingle();
    if (runError) throw runError;
    if (!run) {
      throw new ApiError(404, "generation_not_found", "The generated outfit was not found.");
    }

    const output = objectValue(run.output_summary);
    const parsedOutfit = generatedOutfitSchema.safeParse(output?.outfit);
    if (!parsedOutfit.success) {
      throw new ApiError(
        409,
        "generation_invalid",
        "The generated outfit can no longer be saved safely.",
      );
    }
    const { data: savedId, error: saveError } = await supabase.rpc(
      "save_recorded_generated_outfit",
      {
        p_generation_id: input.generationId,
      },
    );
    if (saveError || typeof savedId !== "string") {
      throw saveError ?? new Error("Generated outfit save failed.");
    }
    return ok({ id: savedId, source: "ai" as const }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
