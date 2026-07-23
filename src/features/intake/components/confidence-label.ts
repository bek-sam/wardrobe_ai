export function confidenceLabel(confidence: Record<string, number>) {
  const values = Object.values(confidence);
  if (!values.length) return { label: "Needs your review", tone: "outline" as const };
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= 0.8) return { label: "High confidence", tone: "sage" as const };
  if (average >= 0.55) return { label: "Medium confidence", tone: "gold" as const };
  return { label: "Low confidence", tone: "rust" as const };
}
