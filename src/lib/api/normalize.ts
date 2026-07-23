export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function safeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

export function safeNumber(value: unknown, minimum?: number, maximum?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (minimum !== undefined && value < minimum) return null;
  if (maximum !== undefined && value > maximum) return null;
  return value;
}

export function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}
