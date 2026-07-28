import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import { sanitizeStylistStructuredResult } from "@/features/stylist/history";
import type { stylistRequestSchema } from "@/features/stylist/schemas";
import { runWardrobeOrchestrator, type ResolvedIntent } from "@/lib/ai/agents/orchestrator";

import { emitStreamError } from "./emit-stream-error";
import { toOrchestratorInput } from "./orchestrator-input";
import { sseEvent } from "./sse";

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

type EmitContext = {
  userId: string;
  conversationId: string;
  input: StylistRequestInput;
  /** Resolved at the authenticated boundary; never re-classified here. */
  resolved: ResolvedIntent;
};

export async function emitStylistResult(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  supabase: SupabaseClient,
  { userId, conversationId, input, resolved }: EmitContext,
) {
  try {
    const result = await runWardrobeOrchestrator(toOrchestratorInput(userId, input), resolved);
    const userVisibleResult = sanitizeStylistStructuredResult(result);
    if (!userVisibleResult) throw new Error("The stylist result could not be serialized.");
    const { error } = await supabase.from("messages").insert({
      user_id: userId,
      conversation_id: conversationId,
      role: "assistant",
      content: userVisibleResult.answer,
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
