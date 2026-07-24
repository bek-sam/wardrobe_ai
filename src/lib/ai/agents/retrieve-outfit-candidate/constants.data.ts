// Below this, an LLM-composed outfit is more likely to serve the user well
// than the best available stored combination.
export const RETRIEVAL_MIN_SCORE = 0.55;
// A much wider prefiltered pool than a flat "top 25 by static score": live
// weather/occasion/exposure filtering runs across this whole pool instead of
// truncating before it gets a chance to apply.
export const RETRIEVAL_POOL_LIMIT = 150;
export const MAX_RESULTS = 3;
export const RECENT_SUGGESTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
