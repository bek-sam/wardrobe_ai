export const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));

export const finiteOrUndefined = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

export function midpoint(minimum: number | undefined, maximum: number | undefined) {
  if (minimum !== undefined && maximum !== undefined) return (minimum + maximum) / 2;
  return minimum ?? maximum;
}
