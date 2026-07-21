import { NextResponse } from "next/server";
import { routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";
import { createClient } from "@/lib/supabase/server";

type InsightItem = {
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

function increment(map: Map<string, number>, key: string, amount = 1) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function sortedCounts(map: Map<string, number>) {
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((first, second) => second.count - first.count || first.name.localeCompare(second.name));
}

export async function GET() {
  try {
    const viewer = await requireViewer();
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select(
        "id,name,category,subcategory,layer_role,color_names,season_tags,wear_count,last_worn_at,purchase_price,currency",
      )
      .eq("user_id", viewer.id)
      .eq("status", "active")
      .is("deleted_at", null);
    if (error) throw error;
    const items = (data ?? []) as InsightItem[];
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
    const byWear = [...items].sort(
      (first, second) =>
        second.wear_count - first.wear_count || first.name.localeCompare(second.name),
    );
    const hasBaseFoundation =
      (roles.get("dress") ?? 0) > 0 ||
      ((roles.get("top") ?? 0) > 0 && (roles.get("bottom") ?? 0) > 0);
    const missingFoundations = [
      ...(!hasBaseFoundation && (roles.get("top") ?? 0) === 0 ? ["top"] : []),
      ...(!hasBaseFoundation && (roles.get("bottom") ?? 0) === 0 ? ["bottom"] : []),
      ...((roles.get("shoes") ?? 0) === 0 ? ["shoes"] : []),
      ...((roles.get("layer") ?? 0) === 0 ? ["layer"] : []),
    ];
    const overrepresented = sortedCounts(categories)
      .filter((category) => items.length >= 5 && category.count / items.length >= 0.4)
      .map((category) => ({
        ...category,
        note: `${category.name} makes up a large share of this wardrobe; review fit and usage before adding more.`,
      }));
    const costPerWear = items
      .filter((item) => item.purchase_price !== null && item.wear_count > 0)
      .map((item) => ({
        itemId: item.id,
        name: item.name,
        value: Number(item.purchase_price) / item.wear_count,
        currency: item.currency,
      }))
      .sort((first, second) => first.value - second.value);

    return NextResponse.json(
      {
        data: {
          itemCount: items.length,
          categories: sortedCounts(categories),
          colors: sortedCounts(colors),
          seasonalWear: sortedCounts(seasons),
          mostWorn: byWear.slice(0, 8),
          leastWorn: [...byWear].reverse().slice(0, 8),
          neverWorn: items.filter((item) => item.wear_count === 0),
          costPerWear,
          possibleFoundations:
            (roles.get("top") ?? 0) * (roles.get("bottom") ?? 0) + (roles.get("dress") ?? 0),
          gapSuggestions: missingFoundations.map((role) => ({
            role,
            note: `No active ${role} is recorded. Add one only if it matches your real routines.`,
          })),
          overrepresented,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
