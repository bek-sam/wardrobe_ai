const FORMALITY_DESCRIPTIONS: Readonly<Record<number, string>> = {
  1: "very casual",
  2: "casual",
  3: "smart casual",
  4: "business/formal",
  5: "black tie/formal",
};

export function describeFormalityLevel(level: number): string {
  const rounded = Math.round(Math.min(5, Math.max(1, level)));
  return FORMALITY_DESCRIPTIONS[rounded] ?? "casual";
}

export function evaluateFormalityConsistency(levels: readonly number[]): {
  consistent: boolean;
  spread: number;
  guidance: string;
} {
  if (levels.length === 0) {
    return { consistent: true, spread: 0, guidance: "No formality data available." };
  }
  const spread = Math.max(...levels) - Math.min(...levels);
  const consistent = spread <= 1;
  return {
    consistent,
    spread,
    guidance: consistent
      ? "Formality levels are consistent across the outfit."
      : `Formality spans a ${spread}-point range -- pieces may not read as belonging together.`,
  };
}
