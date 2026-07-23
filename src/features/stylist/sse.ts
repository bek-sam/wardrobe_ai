import { parseSseBlock } from "./parse-sse-block";
import { sseResponseError } from "./sse-response-error";
import type { SseEvent } from "./parse-sse-block";

export async function consumeSse(
  response: Response,
  onEvent: (event: SseEvent) => Promise<void> | void,
) {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(sseResponseError(payload, `The stylist request failed (${response.status}).`));
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    throw new Error("The stylist did not return an event stream.");
  }
  if (!response.body) throw new Error("The stylist response stream is unavailable.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    while (true) {
      const boundary = buffer.match(/\r?\n\r?\n/);
      if (!boundary || boundary.index === undefined) break;
      const block = buffer.slice(0, boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const parsed = parseSseBlock(block);
      if (parsed) await onEvent(parsed);
    }
    if (done) break;
  }
  if (buffer.trim()) {
    const parsed = parseSseBlock(buffer);
    if (parsed) await onEvent(parsed);
  }
}
