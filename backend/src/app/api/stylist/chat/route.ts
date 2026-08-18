import { stylistRequestSchema } from "@/features/stylist";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import { resolveChatIntentWithQuota } from "./resolve-chat-intent";
import { ApiError } from "@/lib/api/response";
import type { ResolvedIntent } from "@/lib/ai/agents/orchestrator";
import { sanitizeStylistStructuredResult } from "@/features/stylist";
import { runWardrobeOrchestrator } from "@/lib/ai/agents/orchestrator/run";
import type { StylistOrchestratorInput } from "@/lib/ai/agents/orchestrator";

function sseEvent(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

type OrchestratorRequestInput = z.infer<typeof stylistRequestSchema>;

/** Maps one validated chat request onto the orchestrator's input shape. */
function toOrchestratorInput(
  userId: string,
  input: OrchestratorRequestInput,
): StylistOrchestratorInput {
  return {
    userId,
    request: input.message,
    date: input.date,
    location: input.location,
    occasion: input.occasion,
    targetFormality: input.targetFormality,
    indoorOutdoor: input.indoorOutdoor,
  };
}

// ApiError messages are written for users and are already returned verbatim by
// routeError on ordinary routes (quota limits, "No available wardrobe items
// match this request."), so forwarding them keeps a streamed failure as
// actionable as the same failure on a JSON route. Anything else stays generic.
function emitStreamError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  error: unknown,
) {
  const known = error instanceof ApiError;
  if (!known) {
    console.error("Stylist stream failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
  }
  controller.enqueue(
    encoder.encode(
      sseEvent("error", {
        code: known ? error.code : "stylist_failed",
        message: known ? error.message : "A wardrobe recommendation could not be completed.",
      }),
    ),
  );
}

type EmittedStylistRequestInput = z.infer<typeof stylistRequestSchema>;

type EmitContext = {
  userId: string;
  conversationId: string;
  input: EmittedStylistRequestInput;
  /** Resolved at the authenticated boundary; never re-classified here. */
  resolved: ResolvedIntent;
};

async function emitStylistResult(
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

type StreamRequestInput = z.infer<typeof stylistRequestSchema>;

function buildResponseStream(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  input: StreamRequestInput,
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

async function ensureConversation(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string | null,
  message: string,
): Promise<string> {
  if (conversationId) {
    const { data, error } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new ApiError(404, "conversation_not_found", "Conversation not found.");
    return conversationId;
  }

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_id: userId, title: message.slice(0, 80) })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

type StylistRequestInput = z.infer<typeof stylistRequestSchema>;

async function handleStylistChat(
  supabase: SupabaseClient,
  userId: string,
  input: StylistRequestInput,
) {
  // Route first, then charge: a deterministic wardrobe lookup or insight must
  // not spend a stylist generation, and a planning or packing turn must spend
  // exactly one planner unit rather than one of each.
  const resolved = await resolveChatIntentWithQuota(supabase, {
    userId,
    request: input.message,
    date: input.date,
  });

  const conversationId = await ensureConversation(
    supabase,
    userId,
    input.conversationId ?? null,
    input.message,
  );

  const { error: messageError } = await supabase.from("messages").insert({
    user_id: userId,
    conversation_id: conversationId,
    role: "user",
    content: input.message,
    structured_result: null,
  });
  if (messageError) throw messageError;

  return buildResponseStream(supabase, userId, conversationId, input, resolved);
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, stylistRequestSchema),
      createClient(),
    ]);

    const stream = await handleStylistChat(supabase, viewer.id, input);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
