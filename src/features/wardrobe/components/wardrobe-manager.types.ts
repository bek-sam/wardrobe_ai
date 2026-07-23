import type {
  AvailabilityStatus,
  WardrobeItem,
  WardrobeItemRole,
  WardrobeItemStatus,
} from "@/features/wardrobe/types";

export type WardrobeListResponse = {
  items: LiveWardrobeItem[];
  count: number;
  limit: number;
  offset: number;
};

export type LiveWardrobeItem = WardrobeItem & { primary_image_url?: string | null };

export type ItemFormValues = {
  name: string;
  category: string;
  brand: string;
  primaryColorHex: string;
  colorNames: string;
  layerRole: WardrobeItemRole | "";
  notes: string;
};

export type WardrobeResultsSectionProps = {
  loading: boolean;
  items: LiveWardrobeItem[];
  listView: boolean;
  hasQuery: boolean;
  busyItemId: string | null;
  onEdit: (item: LiveWardrobeItem) => void;
  onFavorite: (item: LiveWardrobeItem) => void;
  onAvailability: (item: LiveWardrobeItem, next: LiveWardrobeItem["availability_status"]) => void;
  onDelete: (item: LiveWardrobeItem) => void;
  onClearAllFilters: () => void;
  onAddManually: () => void;
};

export type WardrobeManagerFiltersProps = {
  filters: WardrobeFilters;
  setFilter: <Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) => void;
  filtersOpen: boolean;
  setFiltersOpen: (updater: (current: boolean) => boolean) => void;
  clearAdvancedFilters: () => void;
  clearAllFilters: () => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
  total: number;
};

export type WardrobeFilters = {
  search: string;
  category: string;
  availability: AvailabilityStatus | "";
  itemStatus: WardrobeItemStatus | "";
  brand: string;
  color: string;
  season: string;
  occasion: string;
  formality: string;
  favoritesOnly: boolean;
};
