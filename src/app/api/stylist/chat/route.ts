import { sanitizeStylistStructuredResult } from "@/features/stylist/history";
import { stylistRequestSchema } from "@/features/stylist/schemas";
import { ApiError, parseJson, routeError } from "@/lib/api/response";
import { runWardrobeOrchestrator } from "@/lib/ai/agents/orchestrator";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";
import { enforceAiUsageLimits } from "@/lib/usage/limits";

export const runtime = "nodejs";
export const maxDuration = 300;

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  try {
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, stylistRequestSchema),
      createClient(),
    ]);
    const environment = getServerEnvironment();
    await enforceAiUsageLimits(supabase, {
      feature: "stylist_generation",
      dailyLimit: environment.DAILY_STYLIST_LIMIT,
      rollingBucket: "stylist_generation",
      rollingLimit: environment.STYLIST_RATE_LIMIT_PER_MINUTE,
    });
    let conversationId = input.conversationId ?? null;
    if (conversationId) {
      const { data, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", viewer.id)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new ApiError(404, "conversation_not_found", "Conversation not found.");
    } else {
      const { data, error } = await supabase
        .from("conversations")
        .insert({ user_id: viewer.id, title: input.message.slice(0, 80) })
        .select("id")
        .single();
      if (error) throw error;
      conversationId = data.id;
    }
    const { error: messageError } = await supabase.from("messages").insert({
      user_id: viewer.id,
      conversation_id: conversationId,
      role: "user",
      content: input.message,
      structured_result: null,
    });
    if (messageError) throw messageError;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(event("status", { state: "thinking", conversationId })));
        void (async () => {
          try {
            const result = await runWardrobeOrchestrator({
              userId: viewer.id,
              request: input.message,
              date: input.date,
              location: input.location,
              occasion: input.occasion,
              targetFormality: input.targetFormality,
              indoorOutdoor: input.indoorOutdoor,
            });
            const userVisibleResult = sanitizeStylistStructuredResult(result);
            if (!userVisibleResult) throw new Error("The stylist result could not be serialized.");
            const { error: assistantMessageError } = await supabase.from("messages").insert({
              user_id: viewer.id,
              conversation_id: conversationId,
              role: "assistant",
              content: userVisibleResult.outfit.explanation,
              structured_result: userVisibleResult,
            });
            if (assistantMessageError) throw assistantMessageError;
            controller.enqueue(
              encoder.encode(event("result", { conversationId, ...userVisibleResult })),
            );
          } catch (error) {
            console.error("Stylist stream failed", {
              name: error instanceof Error ? error.name : "UnknownError",
            });
            controller.enqueue(
              encoder.encode(
                event("error", {
                  code: "stylist_failed",
                  message: "A wardrobe recommendation could not be completed.",
                }),
              ),
            );
          } finally {
            controller.close();
          }
        })();
      },
    });
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
