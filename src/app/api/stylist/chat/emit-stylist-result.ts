import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { sanitizeStylistStructuredResult } from "@/features/stylist/history";
import type { stylistRequestSchema } from "@/features/stylist/schemas";
import { runWardrobeOrchestrator } from "@/lib/ai/agents/orchestrator";

import { emitStreamError } from "./emit-stream-error";
import { sseEvent } from "./sse";

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

export async function emitStylistResult(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  input: StylistRequestInput,
) {
  try {
    const result = await runWardrobeOrchestrator({
      userId,
      request: input.message,
      date: input.date,
      location: input.location,
      occasion: input.occasion,
      targetFormality: input.targetFormality,
      indoorOutdoor: input.indoorOutdoor,
    });
    const userVisibleResult = sanitizeStylistStructuredResult(result);
    if (!userVisibleResult) throw new Error("The stylist result could not be serialized.");
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      conversation_id: conversationId,
      role: "assistant",
      content: userVisibleResult.outfit.explanation,
      structured_result: userVisibleResult,
    });
    if (error) throw error;
    controller.enqueue(
      encoder.encode(sseEvent("result", { conversationId, ...userVisibleResult })),
    );
  } catch (error) {
    emitStreamError(controller, encoder, error);
  } finally {
    controller.close();
  }
}
