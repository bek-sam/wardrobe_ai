import type { GarmentCategory } from "@/components/garments/GarmentArtwork";
import { CoatHanger, CurrencyDollar, Recycle, TrendUp, type Icon } from "@phosphor-icons/react";
import type { GarmentPreviewItem } from "@/components/garments/GarmentArtwork";
import { errorMessage } from "@/lib/api/request";
import { useEffect, useMemo, useState } from "react";

export type Count = { name: string; count: number };

export type StatCard = { icon: Icon; label: string; value: string; note: string };

export type InsightItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layer_role: GarmentCategory | null;
  color_names: string[];
  season_tags: string[];
  wear_count: number;
  last_worn_at: string | null;
  purchase_price: number | null;
  currency: string | null;
};

export type Insights = {
  itemCount: number;
  categories: Count[];
  colors: Count[];
  seasonalWear: Count[];
  mostWorn: InsightItem[];
  leastWorn: InsightItem[];
  neverWorn: InsightItem[];
  costPerWear: Array<{ itemId: string; name: string; value: number; currency: string | null }>;
  possibleFoundations: number;
  gapSuggestions: Array<{ role: string; note: string }>;
  overrepresented: Array<{ name: string; count: number; note: string }>;
};

export type RediscoverEntry = {
  id: string;
  category: GarmentCategory;
  color: string;
  label: string;
  name: string;
  detail: string;
};

const namedColors: Record<string, string> = {
  black: "#292724",
  blue: "#45617d",
  brown: "#79583d",
  camel: "#9c7250",
  cream: "#eee8da",
  ecru: "#d8d0bf",
  forest: "#455746",
  gray: "#777774",
  green: "#55705b",
  grey: "#777774",
  navy: "#293647",
  orange: "#ba683e",
  pink: "#b9858f",
  purple: "#766080",
  red: "#9b443d",
  rust: "#8c493d",
  stone: "#ddd4c2",
  tan: "#b3946d",
  white: "#f4f0e8",
  yellow: "#c99a3f",
};

export const PREVIEW_STATS: StatCard[] = [
  { icon: CoatHanger, label: "Sample pieces", value: "8", note: "5 categories" },
  { icon: TrendUp, label: "Sample wears", value: "60", note: "+8 this month" },
  { icon: CurrencyDollar, label: "Avg. cost / wear", value: "$7.40", note: "Sample value" },
  { icon: Recycle, label: "Under-worn", value: "2", note: "Fewer than 4 wears" },
];

export const PREVIEW_CATEGORY_BARS = [
  { name: "Tops", percent: 28 },
  { name: "Bottoms", percent: 19 },
  { name: "Layers", percent: 16 },
  { name: "Shoes", percent: 22 },
  { name: "Accessories", percent: 15 },
];

export const PREVIEW_PALETTE = ["Navy", "Stone", "Forest", "Camel", "Rust"];

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function colorValue(name: string) {
  const normalized = name.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized;
  if (namedColors[normalized]) return namedColors[normalized];
  let hash = 0;
  for (const character of normalized) hash = (hash * 31 + character.charCodeAt(0)) % 360;
  return `hsl(${hash} 24% 42%)`;
}

function artworkCategory(item: InsightItem): GarmentCategory {
  if (item.layer_role) return item.layer_role;
  const category = item.category.toLowerCase();
  if (category.includes("bottom") || category.includes("pant") || category.includes("skirt")) {
    return "bottom";
  }
  if (category.includes("dress")) return "dress";
  if (category.includes("outer") || category.includes("layer") || category.includes("jacket")) {
    return "layer";
  }
  if (category.includes("shoe")) return "shoes";
  if (category.includes("access") || category.includes("bag")) return "accessory";
  return "top";
}

function wearNote(item: InsightItem) {
  if (item.wear_count === 0) return "No recorded wears yet";
  if (!item.last_worn_at) {
    return `${item.wear_count} recorded ${item.wear_count === 1 ? "wear" : "wears"}`;
  }
  return `Last worn ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.last_worn_at))}`;
}

export function buildCategoryBars(insights: Insights) {
  return insights.categories.map((category) => ({
    name: titleCase(category.name),
    percent: Math.round((category.count / insights.itemCount) * 100),
  }));
}

export function buildRediscoverEntries(items: InsightItem[]): RediscoverEntry[] {
  return items.map((item) => ({
    id: item.id,
    category: artworkCategory(item),
    color: colorValue(item.color_names[0] ?? "stone"),
    label: titleCase(item.category),
    name: item.name,
    detail: wearNote(item),
  }));
}

export function buildPreviewRediscoverEntries(items: GarmentPreviewItem[]): RediscoverEntry[] {
  return items.slice(4, 7).map((item) => ({
    id: item.id,
    category: item.category,
    color: item.color,
    label: item.categoryLabel,
    name: item.name,
    detail: item.meta,
  }));
}

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

export async function loadInsights(signal: AbortSignal): Promise<Insights> {
  const response = await fetch("/api/insights", { signal });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<Insights> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, "Wardrobe insights could not be loaded."));
  }
  return payload.data;
}

export function useInsights(configured: boolean) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      loadInsights(controller.signal)
        .then(setInsights)
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(
            caught instanceof Error ? caught.message : "Wardrobe insights could not be loaded.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [configured, retry]);

  const costSummary = useMemo(() => {
    if (!insights?.costPerWear.length) return null;
    const currency = insights.costPerWear[0]?.currency;
    if (!currency || insights.costPerWear.some((entry) => entry.currency !== currency)) return null;
    const average =
      insights.costPerWear.reduce((sum, entry) => sum + entry.value, 0) /
      insights.costPerWear.length;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(average);
    } catch {
      return `${average.toFixed(2)} ${currency}`;
    }
  }, [insights]);

  return { insights, loading, error, retry, setRetry, costSummary };
}
