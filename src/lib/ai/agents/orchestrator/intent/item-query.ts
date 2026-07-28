import type { ItemQuery } from "./types";
import { COLOR_WORDS, GARMENT_WORDS, QUERY_STOPWORDS } from "./vocabulary.data";

/** Crude but predictable singularisation; matching is substring-based anyway. */
export function singularize(word: string) {
  if (/(?:s|x|z|ch|sh)es$/.test(word)) return word.slice(0, -2);
  if (/[^s]s$/.test(word)) return word.slice(0, -1);
  return word;
}

/**
 * Turns "do I own a blue blazer?" into the tokens a wardrobe lookup needs.
 * Colours and garment words are kept separately so they can be required
 * matches rather than merely boosting the score.
 */
export function buildItemQuery(request: string): ItemQuery {
  const text = request.toLowerCase();
  const tokens = text
    .split(/[^a-z0-9'’-]+/)
    .map((token) => singularize(token.trim()))
    .filter((token) => token.length > 1 && !QUERY_STOPWORDS.has(token));

  const terms = [...new Set(tokens)];
  return {
    raw: request.trim().slice(0, 200),
    terms,
    colors: terms.filter((token) => COLOR_WORDS.has(token)),
    categories: terms.filter((token) => GARMENT_WORDS.has(token)),
    favoritesOnly: /\bfavou?rites?\b/.test(text),
    availableOnly: /\b(?:clean|available|ready to wear|not in (?:the )?laundry)\b/.test(text),
  };
}
