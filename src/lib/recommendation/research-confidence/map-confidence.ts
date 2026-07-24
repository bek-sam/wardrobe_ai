import type { ResearchConfidenceInput, ResearchConfidenceResult } from "./types";

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function mapResearchConfidence(input: ResearchConfidenceInput): ResearchConfidenceResult {
  const rawConfidence = input.confidence ?? 0;
  const confidence = clamp01(Number.isFinite(rawConfidence) ? rawConfidence : 0);
  const sources = input.sourceTypes ?? [];
  const hasOfficialSource = sources.includes("official_brand");
  const hasReliableSource = hasOfficialSource || sources.includes("retailer");
  const rawMatchingTextClues = input.matchingTextClues ?? 0;
  const matchingTextClues = Math.max(
    0,
    Math.floor(Number.isFinite(rawMatchingTextClues) ? rawMatchingTextClues : 0),
  );
  const reasons: string[] = [];

  if (input.candidateFound === false || sources.length === 0) {
    return {
      status: "not_found",
      confidence,
      reasons: [
        sources.length === 0 ? "No supporting source was found." : "No candidate was found.",
      ],
    };
  }

  if (input.visualSimilarityOnly) {
    return {
      status: "uncertain",
      confidence: Math.min(confidence, 0.49),
      reasons: ["Visual similarity alone cannot verify a product identity."],
    };
  }

  if (input.exactIdentifierMatch && hasOfficialSource) {
    reasons.push("An exact identifier matches an official brand source.");
    return { status: "verified", confidence: Math.max(confidence, 0.9), reasons };
  }

  if (
    hasReliableSource &&
    confidence >= 0.7 &&
    (input.exactIdentifierMatch || (input.userConfirmedBrand && matchingTextClues >= 1))
  ) {
    reasons.push("Reliable sources and user-confirmed clues support the match.");
    return { status: "likely", confidence, reasons };
  }

  if (!hasReliableSource)
    reasons.push("No official brand or established retailer source supports the match.");
  if (!input.exactIdentifierMatch)
    reasons.push("No exact SKU, barcode, or model identifier matched.");
  if (confidence < 0.7)
    reasons.push("The evidence confidence is below the likely-match threshold.");
  return { status: "uncertain", confidence, reasons };
}
