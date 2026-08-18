import type { Icon } from "@phosphor-icons/react";
import { CoatHanger, Dress, Pants, Sneaker, Tote, TShirt } from "@phosphor-icons/react/ssr";
import type { CSSProperties } from "react";

export type GarmentCategory = "top" | "bottom" | "dress" | "layer" | "shoes" | "accessory";

export interface GarmentPreviewItem {
  id: string;
  name: string;
  category: GarmentCategory;
  categoryLabel: string;
  color: string;
  accent?: string;
  meta: string;
  status?: "available" | "laundry";
  favorite?: boolean;
}

const categoryIcons: Record<GarmentCategory, Icon> = {
  top: TShirt,
  bottom: Pants,
  dress: Dress,
  layer: CoatHanger,
  shoes: Sneaker,
  accessory: Tote,
};

export function GarmentArtwork({
  category,
  color,
  accent,
  compact = false,
}: {
  category: GarmentCategory;
  color: string;
  accent?: string;
  compact?: boolean;
}) {
  const IconComponent = categoryIcons[category];
  const style = { "--garment-color": color, "--garment-accent": accent ?? color } as CSSProperties;

  return (
    <span
      className={`garment-art${compact ? " garment-art--compact" : ""}`}
      style={style}
      aria-hidden="true"
    >
      <span className="garment-art__halo" />
      <IconComponent className="garment-art__icon" weight="duotone" />
    </span>
  );
}
