// Explicit dress-code phrasing, captured verbatim (not mapped onto the fixed
// occasion categories) so a stricter constraint than the category's default
// formality is never silently dropped.
const DRESS_CODE_PATTERNS: readonly RegExp[] = [
  /black[\s-]?tie(?:\s+optional)?/i,
  /white[\s-]?tie/i,
  /cocktail attire/i,
  /business casual/i,
  /smart casual/i,
  /no jeans/i,
  /all[\s-]?white/i,
  /all[\s-]?black/i,
  /formal attire/i,
  /costume|themed/i,
];

export function detectDressCodeConstraints(text: string): string[] {
  const matches: string[] = [];
  for (const pattern of DRESS_CODE_PATTERNS) {
    const match = text.match(pattern);
    if (match) matches.push(match[0].toLowerCase());
  }
  return matches;
}
