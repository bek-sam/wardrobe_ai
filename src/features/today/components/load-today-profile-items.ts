import { isObject } from "@/lib/api/normalize";

import { normalizeItem } from "./normalize-today-item";
import { normalizeProfile } from "./normalize-today-profile";
import { requestJson } from "./today-request";
import type { TodayItem, TodayProfile } from "./today.types";

export async function loadTodayProfileItems(signal: AbortSignal) {
  const [profileResult, itemsResult] = await Promise.allSettled([
    requestJson<unknown>("/api/profile", { signal }),
    requestJson<unknown>("/api/items?status=active&limit=8", { signal }),
  ]);

  const errors: string[] = [];
  let profile: TodayProfile | null = null;
  if (profileResult.status === "fulfilled") {
    profile = normalizeProfile(profileResult.value);
    if (!profile) errors.push("Your profile response could not be read.");
  } else if (!(
    profileResult.reason instanceof DOMException && profileResult.reason.name === "AbortError"
  )) {
    errors.push(
      profileResult.reason instanceof Error
        ? profileResult.reason.message
        : "Your profile could not be loaded.",
    );
  }

  let items: TodayItem[] = [];
  let itemCount = 0;
  if (itemsResult.status === "fulfilled" && isObject(itemsResult.value)) {
    const rawItems = Array.isArray(itemsResult.value.items) ? itemsResult.value.items : [];
    items = rawItems
      .map((item) => normalizeItem(item))
      .filter((item): item is TodayItem => Boolean(item));
    itemCount =
      typeof itemsResult.value.count === "number" && Number.isInteger(itemsResult.value.count)
        ? Math.max(0, itemsResult.value.count)
        : items.length;
  } else if (itemsResult.status === "rejected") {
    if (!(itemsResult.reason instanceof DOMException && itemsResult.reason.name === "AbortError")) {
      errors.push(
        itemsResult.reason instanceof Error
          ? itemsResult.reason.message
          : "Recent wardrobe items could not be loaded.",
      );
    }
  } else {
    errors.push("Your wardrobe response could not be read.");
  }

  return { profile, items, itemCount, errors };
}
