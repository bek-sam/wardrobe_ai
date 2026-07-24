import {
  CalendarBlank,
  ChartDonut,
  CoatHanger,
  GearSix,
  HouseLine,
  Sparkle,
  SquaresFour,
} from "@phosphor-icons/react";

export const primaryItems = [
  { href: "/today", label: "Today", icon: HouseLine },
  { href: "/wardrobe", label: "Wardrobe", icon: CoatHanger },
  { href: "/stylist", label: "Stylist", icon: Sparkle },
  { href: "/planner", label: "Planner", icon: CalendarBlank },
  { href: "/outfits", label: "Outfits", icon: SquaresFour },
  { href: "/insights", label: "Insights", icon: ChartDonut },
] as const;

export const secondaryItems = [{ href: "/settings", label: "Settings", icon: GearSix }] as const;
