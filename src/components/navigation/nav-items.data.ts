import {
  CalendarBlank,
  ChartDonut,
  CoatHanger,
  GearSix,
  HouseLine,
  MagicWand,
  Sparkle,
  SquaresFour,
} from "@phosphor-icons/react";

export const primaryItems = [
  { href: "/today", label: "Today", icon: HouseLine },
  { href: "/wardrobe", label: "Wardrobe", icon: CoatHanger },
  { href: "/studio", label: "Studio", icon: MagicWand },
  { href: "/stylist", label: "Stylist", icon: Sparkle },
  { href: "/planner", label: "Planner", icon: CalendarBlank },
  { href: "/outfits", label: "Outfits", icon: SquaresFour },
  { href: "/insights", label: "Insights", icon: ChartDonut },
] as const;

/**
 * What the mobile bottom bar shows, named explicitly rather than taken as
 * `primaryItems.slice(0, n)`. That slice meant inserting one desktop item
 * silently pushed a different one off mobile — which is how Outfits
 * disappeared the moment Studio was added.
 *
 * Six fits: at the 320px minimum width each target is still ~48px wide, above
 * the 44px floor. Insights is the one destination that stays desktop-only.
 */
export const mobileItems = [
  primaryItems[0],
  primaryItems[1],
  primaryItems[2],
  primaryItems[3],
  primaryItems[4],
  primaryItems[5],
] as const;

export const secondaryItems = [{ href: "/settings", label: "Settings", icon: GearSix }] as const;
