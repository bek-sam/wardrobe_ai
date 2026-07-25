import { isObject, safeNullableString, safeString } from "@/lib/api/normalize";

export function highlightLines(value: Record<string, unknown>) {
  return Array.isArray(value.highlights)
    ? value.highlights.filter(isObject).map((entry) => {
        const detail = safeNullableString(entry.detail);
        return detail ? `${safeString(entry.label)} — ${detail}` : safeString(entry.label);
      })
    : [];
}

export function matchLines(value: Record<string, unknown>) {
  return Array.isArray(value.matches)
    ? value.matches.filter(isObject).map((match) => {
        const colors = Array.isArray(match.colorNames) ? match.colorNames.join("/") : "";
        const facts = [safeString(match.category), colors, safeString(match.availability)];
        return `${safeString(match.name)} — ${facts.filter(Boolean).join(" · ")}`;
      })
    : [];
}
