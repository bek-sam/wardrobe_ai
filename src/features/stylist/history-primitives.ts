export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function nullableString(value: unknown, maximum: number) {
  return typeof value === "string" && value.trim() ? value.slice(0, maximum) : null;
}

export function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
