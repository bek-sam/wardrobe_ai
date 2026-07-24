// Hard cap enforced both by the caller building the shortlist
// (compile-wardrobe.ts) and defensively here, so a caller bug can never turn
// one compile into an unbounded-cost curator call.
export const MAX_CURATOR_INPUT_CANDIDATES = 40;
