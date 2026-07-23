export type SseEvent = { name: string; data: unknown };

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
