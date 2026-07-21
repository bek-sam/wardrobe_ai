import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";

const CATEGORY_ROLE_MAP: Readonly<Record<string, WardrobeItemRole>> = {
  upperbody: "top",
  top: "top",
  tops: "top",
  shirt: "top",
  shirts: "top",
  blouse: "top",
  sweater: "top",
  knitwear: "top",
  tee: "top",
  tshirt: "top",
  lowerbody: "bottom",
  bottom: "bottom",
  bottoms: "bottom",
  pants: "bottom",
  trousers: "bottom",
  jeans: "bottom",
  skirt: "bottom",
  shorts: "bottom",
  wholebody: "dress",
  dress: "dress",
  dresses: "dress",
  wholebodyup: "layer",
  layer: "layer",
  outerwear: "layer",
  jacket: "layer",
  jackets: "layer",
  coat: "layer",
  coats: "layer",
  shoes: "shoes",
  shoe: "shoes",
  footwear: "shoes",
  accessoriesup: "accessory",
  accessory: "accessory",
  accessories: "accessory",
};

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

export function resolveWardrobeItemRole(
  item: Pick<WardrobeItem, "layer_role" | "category" | "subcategory">,
): WardrobeItemRole | null {
  if (item.layer_role) return item.layer_role;

  for (const value of [item.subcategory, item.category]) {
    if (!value) continue;
    const role = CATEGORY_ROLE_MAP[normalize(value)];
    if (role) return role;
  }

  return null;
}
