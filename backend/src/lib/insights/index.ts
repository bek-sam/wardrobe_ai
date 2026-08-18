import { resolveWardrobeItemRole } from "@/lib/recommendation";
import type { SupabaseClient } from "@supabase/supabase-js";

export type InsightItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layer_role: "top" | "bottom" | "dress" | "layer" | "shoes" | "accessory" | null;
  color_names: string[];
  season_tags: string[];
  wear_count: number;
  last_worn_at: string | null;
  purchase_price: number | null;
  currency: string | null;
};

export type UnwornItem = {
  item: InsightItem;
  lastWornDate: string | null;
  daysSince: number | null;
};

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedCounts(map: ReadonlyMap<string, number>) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

function tallyItems(items: readonly InsightItem[]) {
  const categories = new Map<string, number>();
  const colors = new Map<string, number>();
  const seasons = new Map<string, number>();
  const roles = new Map<string, number>();

  for (const item of items) {
    increment(categories, item.category);
    for (const color of item.color_names) increment(colors, color.toLowerCase());
    for (const season of item.season_tags)
      increment(seasons, season.toLowerCase(), item.wear_count);
    const role = resolveWardrobeItemRole(item);
    if (role) increment(roles, role);
  }

  return { categories, colors, seasons, roles };
}

function buildCostPerWear(items: readonly InsightItem[]) {
  return items
    .filter((item) => item.purchase_price !== null && item.wear_count > 0)
    .map((item) => ({
      itemId: item.id,
      name: item.name,
      value: Number(item.purchase_price) / item.wear_count,
      currency: item.currency,
    }))
    .sort((first, second) => first.value - second.value);
}

function buildFoundationGaps(roles: ReadonlyMap<string, number>) {
  const hasBaseFoundation =
    (roles.get("dress") ?? 0) > 0 ||
    ((roles.get("top") ?? 0) > 0 && (roles.get("bottom") ?? 0) > 0);
  const missingFoundations = [
    ...(!hasBaseFoundation && (roles.get("top") ?? 0) === 0 ? ["top"] : []),
    ...(!hasBaseFoundation && (roles.get("bottom") ?? 0) === 0 ? ["bottom"] : []),
    ...((roles.get("shoes") ?? 0) === 0 ? ["shoes"] : []),
    ...((roles.get("layer") ?? 0) === 0 ? ["layer"] : []),
  ];
  return missingFoundations.map((role) => ({
    role,
    note: `No active ${role} is recorded. Add one only if it matches your real routines.`,
  }));
}

/** Pure wardrobe analytics over already-fetched, user-scoped rows. */
export function buildWardrobeInsights(items: readonly InsightItem[]) {
  const { categories, colors, seasons, roles } = tallyItems(items);
  const byWear = [...items].sort(
    (first, second) =>
      second.wear_count - first.wear_count || first.name.localeCompare(second.name),
  );

  return {
    itemCount: items.length,
    categories: sortedCounts(categories),
    colors: sortedCounts(colors),
    seasonalWear: sortedCounts(seasons),
    mostWorn: byWear.slice(0, 8),
    leastWorn: [...byWear].reverse().slice(0, 8),
    neverWorn: items.filter((item) => item.wear_count === 0),
    costPerWear: buildCostPerWear(items),
    possibleFoundations:
      (roles.get("top") ?? 0) * (roles.get("bottom") ?? 0) + (roles.get("dress") ?? 0),
    gapSuggestions: buildFoundationGaps(roles),
    overrepresented: sortedCounts(categories)
      .filter((category) => items.length >= 5 && category.count / items.length >= 0.4)
      .map((category) => ({
        ...category,
        note: `${category.name} makes up a large share of this wardrobe; review fit and usage before adding more.`,
      })),
  };
}

export type WardrobeInsights = ReturnType<typeof buildWardrobeInsights>;

const DAY_MS = 86_400_000;

/** Returns never-worn items or items last worn before `since`, oldest first. */
export function buildUnwornItems(
  items: readonly InsightItem[],
  since: string | null,
  referenceDate: string,
): UnwornItem[] {
  const referenceTime = Date.parse(`${referenceDate}T00:00:00.000Z`);
  return items
    .map((item) => {
      const lastWornDate =
        item.wear_count > 0 && item.last_worn_at ? item.last_worn_at.slice(0, 10) : null;
      const daysSince = lastWornDate
        ? Math.max(
            0,
            Math.floor((referenceTime - Date.parse(`${lastWornDate}T00:00:00.000Z`)) / DAY_MS),
          )
        : null;
      return { item, lastWornDate, daysSince };
    })
    .filter((entry) =>
      entry.lastWornDate === null ? true : Boolean(since && entry.lastWornDate < since),
    )
    .sort(
      (first, second) =>
        (second.daysSince ?? Number.MAX_SAFE_INTEGER) -
          (first.daysSince ?? Number.MAX_SAFE_INTEGER) ||
        first.item.name.localeCompare(second.item.name),
    );
}

const PAGE_SIZE = 500;

export async function fetchInsightItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<InsightItem[]> {
  const items: InsightItem[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select(
        "id,name,category,subcategory,layer_role,color_names,season_tags,wear_count,last_worn_at,purchase_price,currency",
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as InsightItem[];
    items.push(...page);
    if (page.length < PAGE_SIZE) return items;
  }
}
