import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { stylistRequestSchema } from "@/features/stylist/schemas";
import type { ResolvedIntent } from "@/lib/ai/agents/orchestrator";

import { emitStylistResult } from "./emit-stylist-result";
import { sseEvent } from "./sse";

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

export function buildResponseStream(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  input: StylistRequestInput,
  resolved: ResolvedIntent,
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sseEvent("status", { state: "thinking", conversationId })));
      void emitStylistResult(controller, encoder, supabase, {
        userId,
        conversationId,
        input,
        resolved,
      });
    },
  });
}
