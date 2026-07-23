import { CoatHanger, CurrencyDollar, Recycle, TrendUp } from "@phosphor-icons/react";

import type { StatCard } from "./StatsGrid";

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
