import { NUMBER_WORDS } from "./rules.data";
import { DESTINATION_STOP_WORDS, NON_DESTINATION_WORDS } from "./vocabulary.data";

const NUMBER_WORD = Object.keys(NUMBER_WORDS).join("|");
/** "for 3 days", "three nights", "a few weeks" -- never part of a place name. */
const LEADING_DURATION = new RegExp(
  `^(?:for\\s+)?(?:a\\s+(?:few|couple\\s+of)|\\d{1,3}|${NUMBER_WORD})\\s+(?:day|days|night|nights|week|weeks)\\b`,
  "i",
);
const LEADING_PREPOSITION = /^(?:in|at|to|around|near|over|into)\b/i;
/** "on Friday", "on the 3rd", "on 2026-08-01" -- a date, not "Newcastle on Tyne". */
const DATE_CLAUSE =
  /\s+on\s+(?:the\s+)?(?:\d|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i;
const STOP_CLAUSE = new RegExp(`\\s+\\b(?:${[...DESTINATION_STOP_WORDS].join("|")})\\b.*$`, "i");
const PLACE_WORD = /^[\p{L}][\p{L}'’.-]*$/u;

const MAX_WORDS = 4;
const MAX_LENGTH = 80;

/** Cuts a capture down to the phrase that could still name a place. */
export function trimDestinationClause(captured: string) {
  const punctuated = captured.split(/[.,;:!?()"]/)[0] ?? "";
  const dated = punctuated.split(DATE_CLAUSE)[0] ?? "";
  return dated.replace(STOP_CLAUSE, "").trim();
}

/** Drops a leading duration ("3 days in ...") and the preposition after it. */
export function stripDurationPrefix(text: string) {
  const withoutDuration = text.replace(LEADING_DURATION, "").trim();
  return withoutDuration.replace(LEADING_PREPOSITION, "").trim();
}

/** A bounded run of word-shaped tokens, or "" when nothing plausible remains. */
export function boundDestination(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  const kept: string[] = [];
  for (const word of words) {
    if (!PLACE_WORD.test(word) || kept.length === MAX_WORDS) break;
    kept.push(word);
  }
  const name = kept.join(" ").slice(0, MAX_LENGTH).trim();
  if (!name) return "";
  const lowered = name.toLowerCase().split(" ");
  return lowered.every((word) => NON_DESTINATION_WORDS.has(word)) ? "" : name;
}
