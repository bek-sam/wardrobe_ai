import { sseEvent } from "./sse";

export function emitStreamError(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  error: unknown,
) {
  console.error("Stylist stream failed", {
    name: error instanceof Error ? error.name : "UnknownError",
  });
  controller.enqueue(
    encoder.encode(
      sseEvent("error", {
        code: "stylist_failed",
        message: "A wardrobe recommendation could not be completed.",
      }),
    ),
  );
}
