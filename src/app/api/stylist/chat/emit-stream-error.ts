import { ApiError } from "@/lib/api/response";

import { sseEvent } from "./sse";

// ApiError messages are written for users and are already returned verbatim by
// routeError on ordinary routes (quota limits, "No available wardrobe items
// match this request."), so forwarding them keeps a streamed failure as
// actionable as the same failure on a JSON route. Anything else stays generic.
export function emitStreamError(
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
