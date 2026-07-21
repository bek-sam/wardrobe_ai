export type SseEvent = { name: string; data: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function responseError(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

export function parseSseBlock(block: string): SseEvent | null {
  let name = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator < 0 ? line : line.slice(0, separator);
    let value = separator < 0 ? "" : line.slice(separator + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") name = value;
    if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  try {
    return { name, data: JSON.parse(data.join("\n")) as unknown };
  } catch {
    throw new Error("The stylist returned an unreadable stream event.");
  }
}

export async function consumeSse(
  response: Response,
  onEvent: (event: SseEvent) => Promise<void> | void,
) {
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(responseError(payload, `The stylist request failed (${response.status}).`));
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
