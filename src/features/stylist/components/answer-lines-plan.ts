import { isObject, safeString } from "@/lib/api/normalize";

function names(items: unknown) {
  return Array.isArray(items)
    ? items
        .filter(isObject)
        .map((item) => safeString(item.name))
        .filter(Boolean)
        .join(", ")
    : "";
}

export function planLines(value: Record<string, unknown>) {
  return Array.isArray(value.days)
    ? value.days
        .filter(isObject)
        .map((day) => `${safeString(day.date)} · ${safeString(day.title)} — ${names(day.items)}`)
    : [];
}

export function packingLines(value: Record<string, unknown>) {
  return Array.isArray(value.packingList)
    ? value.packingList.filter(isObject).map((entry) => {
        const days = typeof entry.dayCount === "number" ? entry.dayCount : 1;
        const unit = days === 1 ? "day" : "days";
        return `${safeString(entry.name)} — ${safeString(entry.role)} · ${days} ${unit}`;
      })
    : [];
}
