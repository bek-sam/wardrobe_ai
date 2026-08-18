import type { WardrobeItem } from "@/features/wardrobe";
import type { GarmentCategory } from "@/components/garments/GarmentArtwork";
import type { AvailabilityStatus, WardrobeItemRole, WardrobeItemStatus } from "@/features/wardrobe";
import { useCallback, useEffect, useMemo, useState } from "react";
import { requestJson } from "@/lib/api/request";
import type { Dispatch, SetStateAction } from "react";
import { errorMessage } from "@/lib/api/request";

export type ItemImage = {
  id: string;
  kind: string;
  signed_url: string;
  is_primary: boolean;
  width: number;
  height: number;
};

export type ItemDetail = WardrobeItem & {
  images: ItemImage[];
  primary_image_url: string | null;
};

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  source_type: string;
};

export type ResearchRun = {
  id: string;
  status: string;
  summary: string;
  confidence: number | null;
  proposed_changes: Record<string, unknown>;
  evidence: Record<string, unknown>;
  research_sources: ResearchSource[];
};

export type ItemEditValues = { name: string; brand: string; category: string; notes: string };

export type ItemAction = (name: string, operation: () => Promise<void>) => Promise<void>;

export type ResearchCardProps = {
  itemId: string;
  latestResearch: ResearchRun | null;
  researchFields: string[];
  researchClue: string;
  setResearchClue: (value: string) => void;
  busy: string | null;
  action: ItemAction;
  reload: () => Promise<void>;
};

export type CompileStatusResponse = {
  dirty_since: string | null;
  last_compiled_at: string | null;
  candidate_count: number;
  compiled_wardrobe_version: string | null;
  latest_job_status: "queued" | "running" | "complete" | "failed" | null;
};

export type RecompileResponse = { status: "up_to_date" | "running" | "queued" | "complete" };

export type LiveWardrobeItem = WardrobeItem & { primary_image_url?: string | null };

export type WardrobeListResponse = {
  items: LiveWardrobeItem[];
  count: number;
  limit: number;
  offset: number;
};

export type ItemFormValues = {
  name: string;
  category: string;
  brand: string;
  primaryColorHex: string;
  colorNames: string;
  layerRole: WardrobeItemRole | "";
  notes: string;
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

export const ACCEPTABLE_RESEARCH_FIELDS = new Set([
  "brand",
  "product_name",
  "model_number",
  "materials",
  "care_instructions",
]);

export const defaultFilters: WardrobeFilters = {
  search: "",
  category: "",
  availability: "",
  itemStatus: "active",
  brand: "",
  color: "",
  season: "",
  occasion: "",
  formality: "",
  favoritesOnly: false,
};

export const categoryFilters = [
  { label: "All pieces", value: "" },
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
  { label: "Layers", value: "outerwear" },
  { label: "Shoes", value: "shoes" },
  { label: "Accessories", value: "accessories" },
] as const;

export const categoryOptions = [
  "tops",
  "bottoms",
  "dresses",
  "outerwear",
  "shoes",
  "accessories",
  "bags",
  "activewear",
  "swimwear",
  "underwear",
  "other",
] as const;

export const SEASON_OPTIONS = [
  { value: "spring", label: "Spring" },
  { value: "summer", label: "Summer" },
  { value: "fall", label: "Fall" },
  { value: "winter", label: "Winter" },
  { value: "year-round", label: "Year-round" },
];

export const OCCASION_OPTIONS = [
  { value: "work", label: "Work" },
  { value: "casual", label: "Casual" },
  { value: "dinner", label: "Dinner" },
  { value: "formal", label: "Formal" },
  { value: "travel", label: "Travel" },
  { value: "outdoors", label: "Outdoors" },
  { value: "athletic", label: "Athletic" },
];

export const FORMALITY_OPTIONS = [
  { value: "1", label: "1 · Very casual" },
  { value: "2", label: "2 · Casual" },
  { value: "3", label: "3 · Balanced" },
  { value: "4", label: "4 · Polished" },
  { value: "5", label: "5 · Formal" },
];

const CATEGORY_TO_ROLE: Readonly<Record<string, WardrobeItemRole>> = {
  tops: "top",
  bottoms: "bottom",
  dresses: "dress",
  outerwear: "layer",
  shoes: "shoes",
  accessories: "accessory",
  bags: "accessory",
};

const CATEGORY_TO_ARTWORK: Readonly<Record<string, GarmentCategory>> = {
  bottom: "bottom",
  bottoms: "bottom",
  dress: "dress",
  dresses: "dress",
  layer: "layer",
  outerwear: "layer",
  shoes: "shoes",
  accessory: "accessory",
  accessories: "accessory",
  bags: "accessory",
};

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export const emptyForm: ItemFormValues = {
  name: "",
  category: "tops",
  brand: "",
  primaryColorHex: "#8b7d6b",
  colorNames: "",
  layerRole: "top",
  notes: "",
};

export function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function roleForCategory(category: string): WardrobeItemRole | "" {
  return CATEGORY_TO_ROLE[category] ?? "";
}

export function formFromItem(item: WardrobeItem): ItemFormValues {
  return {
    name: item.name,
    category: item.category,
    brand: item.brand ?? "",
    primaryColorHex: item.primary_color_hex ?? "",
    colorNames: item.color_names.join(", "),
    layerRole: item.layer_role ?? "",
    notes: item.notes,
  };
}

export function itemPayload(values: ItemFormValues) {
  return {
    name: values.name.trim(),
    category: values.category,
    brand: values.brand.trim() || null,
    primary_color_hex: values.primaryColorHex || null,
    color_names: values.colorNames
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    layer_role: values.layerRole || null,
    notes: values.notes.trim(),
  };
}

export function triggerWardrobeCompile() {
  fetch("/api/wardrobe/compile", { method: "POST" }).catch(() => {});
}

export function activeFilterCount(filters: WardrobeFilters): number {
  return (
    Number(Boolean(filters.availability)) +
    Number(filters.itemStatus !== "active") +
    Number(Boolean(filters.brand.trim())) +
    Number(Boolean(filters.color.trim())) +
    Number(Boolean(filters.season)) +
    Number(Boolean(filters.occasion)) +
    Number(Boolean(filters.formality)) +
    Number(filters.favoritesOnly)
  );
}

export function hasActiveQuery(filters: WardrobeFilters): boolean {
  return Boolean(
    filters.search.trim() ||
    filters.category ||
    filters.availability ||
    filters.itemStatus !== "active" ||
    filters.brand.trim() ||
    filters.color.trim() ||
    filters.season ||
    filters.occasion ||
    filters.formality ||
    filters.favoritesOnly,
  );
}

export function buildWardrobeQuery(filters: WardrobeFilters): URLSearchParams {
  const query = new URLSearchParams({ limit: "100" });
  if (filters.search.trim()) query.set("search", filters.search.trim());
  if (filters.category) query.set("category", filters.category);
  if (filters.availability) query.set("availability", filters.availability);
  if (filters.itemStatus) query.set("status", filters.itemStatus);
  if (filters.brand.trim()) query.set("brand", filters.brand.trim());
  if (filters.color.trim()) query.set("color", filters.color.trim());
  if (filters.season) query.set("season", filters.season);
  if (filters.occasion) query.set("occasion", filters.occasion);
  if (filters.formality) query.set("formality", filters.formality);
  if (filters.favoritesOnly) query.set("favorite", "true");
  return query;
}

export function applyItemUpdate<K extends keyof LiveWardrobeItem>(
  items: LiveWardrobeItem[],
  id: string,
  key: K,
  value: LiveWardrobeItem[K],
  leavesFilter: boolean,
): LiveWardrobeItem[] {
  return leavesFilter
    ? items.filter((entry) => entry.id !== id)
    : items.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry));
}

export function artworkCategory(item: {
  layer_role?: string | null;
  category?: string | null;
}): GarmentCategory {
  const role = item.layer_role?.toLowerCase() ?? "";
  const category = item.category?.toLowerCase() ?? "";
  return CATEGORY_TO_ARTWORK[role] ?? CATEGORY_TO_ARTWORK[category] ?? "top";
}

export function compilationHeadline(
  status: CompileStatusResponse | null,
  isRunning: boolean,
  isFailed: boolean,
): string {
  if (isRunning) return "Recompiling your outfit library…";
  if (isFailed) return "Your outfit library could not be recompiled. You can try again.";
  if (status?.dirty_since) return "Outfit library: changes pending";
  if (status) return `Outfit library: ${status.candidate_count} outfits ready`;
  return "Outfit library: —";
}

export function formatLastCompiled(value: string | null) {
  if (!value) return "never";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return "unknown";
  }
}

export function useItemDetailData(itemId: string) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [research, setResearch] = useState<ResearchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<ItemEditValues>({
    name: "",
    brand: "",
    category: "",
    notes: "",
  });

  const load = useCallback(async () => {
    try {
      const [nextItem, runs] = await Promise.all([
        requestJson<ItemDetail>(`/api/items/${encodeURIComponent(itemId)}`),
        requestJson<ResearchRun[]>(`/api/items/${encodeURIComponent(itemId)}/research`),
      ]);
      setItem(nextItem);
      setResearch(runs);
      setEditValues({
        name: nextItem.name,
        brand: nextItem.brand ?? "",
        category: nextItem.category,
        notes: nextItem.notes,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "This wardrobe item could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const latestResearch = research[0] ?? null;
  const researchFields = useMemo(
    () =>
      latestResearch
        ? Object.keys(latestResearch.proposed_changes).filter((field) =>
            ACCEPTABLE_RESEARCH_FIELDS.has(field),
          )
        : [],
    [latestResearch],
  );

  return {
    item,
    setItem,
    latestResearch,
    researchFields,
    loading,
    error,
    setError,
    editValues,
    setEditValues,
    load,
  };
}

function useItemDetailActions(setError: Dispatch<SetStateAction<string | null>>) {
  const [busy, setBusy] = useState<string | null>(null);

  async function action(name: string, operation: () => Promise<void>) {
    setBusy(name);
    setError(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The action could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  return { busy, action };
}

export function useItemDetail(itemId: string) {
  const data = useItemDetailData(itemId);
  const { busy, action } = useItemDetailActions(data.setError);
  const [researchClue, setResearchClue] = useState("");
  const [editing, setEditing] = useState(false);

  const costPerWear =
    data.item && data.item.purchase_price !== null && data.item.wear_count > 0
      ? `${data.item.currency ?? ""} ${(data.item.purchase_price / data.item.wear_count).toFixed(2)}`.trim()
      : null;

  return { ...data, busy, action, researchClue, setResearchClue, editing, setEditing, costPerWear };
}

export async function startResearch(
  itemId: string,
  researchClue: string,
  reload: () => Promise<void>,
) {
  const run = await requestJson<ResearchRun>(`/api/items/${itemId}/research`, {
    method: "POST",
    body: JSON.stringify({ userClue: researchClue || null }),
  });
  await requestJson(`/api/items/${itemId}/research/${run.id}/process`, { method: "POST" });
  await reload();
}

export async function uploadItemImage(
  itemId: string,
  image: File,
  onWarning: (message: string) => void,
) {
  try {
    const imageData = new FormData();
    imageData.set("file", image);
    const response = await fetch(`/api/items/${itemId}/images`, {
      method: "POST",
      body: imageData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      onWarning(errorMessage(payload, "The garment was saved, but its image was not."));
    }
  } catch {
    onWarning("The garment was saved, but its image upload did not finish.");
  }
}

export function useItemForm(
  item: WardrobeItem | null,
  onSaved: (item: WardrobeItem) => void,
  onWarning: (message: string) => void,
) {
  const [values, setValues] = useState<ItemFormValues>(() =>
    item ? formFromItem(item) : emptyForm,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const editing = Boolean(item);

  function setField<Key extends keyof ItemFormValues>(key: Key, value: ItemFormValues[Key]) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await requestJson<WardrobeItem>(
        editing ? `/api/items/${item?.id}` : "/api/items",
        {
          method: editing ? "PATCH" : "POST",
          body: JSON.stringify(itemPayload(values)),
        },
      );
      if (image) await uploadItemImage(saved.id, image, onWarning);
      onSaved(saved);
      triggerWardrobeCompile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return { values, setField, saving, error, setImage, editing, submit };
}

export function useWardrobeItems(configured: boolean, filters: WardrobeFilters) {
  const [items, setItems] = useState<LiveWardrobeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const query = buildWardrobeQuery(filters);
        const result = await requestJson<WardrobeListResponse>(`/api/items?${query}`, {
          signal: controller.signal,
        });
        setItems(result.items);
        setTotal(result.count);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The wardrobe could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [configured, filters, retry]);

  return { items, setItems, total, setTotal, loading, error, setError, retry, setRetry };
}

export function useWardrobeSort(items: LiveWardrobeItem[]) {
  const [sort, setSort] = useState("recent");

  const sortedItems = useMemo(() => {
    const next = [...items];
    if (sort === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "worn") return next.sort((a, b) => b.wear_count - a.wear_count);
    return next;
  }, [items, sort]);

  return { sort, setSort, sortedItems };
}

export function useWardrobeMutate(setError: Dispatch<SetStateAction<string | null>>) {
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const mutate = useCallback(
    async <T>(itemId: string, path: string, init: RequestInit, apply: (data: T) => void) => {
      setBusyItemId(itemId);
      setError(null);
      try {
        const result = await requestJson<T>(path, init);
        apply(result);
        triggerWardrobeCompile();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "The item could not be updated.");
      } finally {
        setBusyItemId(null);
      }
    },
    [setError],
  );

  return { mutate, busyItemId };
}

type Mutate = <T>(
  itemId: string,
  path: string,
  init: RequestInit,
  apply: (data: T) => void,
) => Promise<void>;

function useWardrobeAvailabilityAction(
  mutate: Mutate,
  setItems: Dispatch<SetStateAction<LiveWardrobeItem[]>>,
  setTotal: Dispatch<SetStateAction<number>>,
  activeAvailability: AvailabilityStatus | "",
) {
  return (itemId: string, next: AvailabilityStatus) =>
    mutate<{ id: string; availability_status: AvailabilityStatus }>(
      itemId,
      `/api/items/${itemId}/availability`,
      { method: "POST", body: JSON.stringify({ availability_status: next }) },
      (data) => {
        const leaves =
          Boolean(activeAvailability) && data.availability_status !== activeAvailability;
        setItems((current) =>
          applyItemUpdate(
            current,
            data.id,
            "availability_status",
            data.availability_status,
            leaves,
          ),
        );
        if (leaves) setTotal((current) => Math.max(0, current - 1));
      },
    );
}

function useWardrobeFilters() {
  const [filters, setFilters] = useState<WardrobeFilters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  function setFilter<Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function clearAdvancedFilters() {
    setFilters((current) => ({
      ...defaultFilters,
      search: current.search,
      category: current.category,
    }));
  }

  function clearAllFilters() {
    setFilters(defaultFilters);
  }

  return { filters, setFilter, filtersOpen, setFiltersOpen, clearAdvancedFilters, clearAllFilters };
}

function useWardrobeItemActions(
  setItems: Dispatch<SetStateAction<LiveWardrobeItem[]>>,
  setTotal: Dispatch<SetStateAction<number>>,
  setError: Dispatch<SetStateAction<string | null>>,
  activeAvailability: AvailabilityStatus | "",
  favoritesOnly: boolean,
) {
  const { mutate, busyItemId } = useWardrobeMutate(setError);
  const setAvailability = useWardrobeAvailabilityAction(
    mutate,
    setItems,
    setTotal,
    activeAvailability,
  );

  const toggleFavorite = (item: LiveWardrobeItem) =>
    mutate<{ id: string; favorite: boolean }>(
      item.id,
      `/api/items/${item.id}/favorite`,
      { method: "POST", body: JSON.stringify({ favorite: !item.favorite }) },
      (data) => {
        const leaves = favoritesOnly && !data.favorite;
        setItems((current) => applyItemUpdate(current, data.id, "favorite", data.favorite, leaves));
        if (leaves) setTotal((current) => Math.max(0, current - 1));
      },
    );

  const deleteItem = (item: LiveWardrobeItem) => {
    if (!window.confirm(`Delete “${item.name}” and its associated images?`)) return;
    void mutate<{ deleted: true; id: string }>(
      item.id,
      `/api/items/${item.id}`,
      { method: "DELETE" },
      (data) => {
        setItems((current) => current.filter((entry) => entry.id !== data.id));
        setTotal((current) => Math.max(0, current - 1));
      },
    );
  };

  return { busyItemId, setAvailability, toggleFavorite, deleteItem };
}

export function useWardrobeManagerState(configured: boolean) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  const filterState = useWardrobeFilters();
  const itemsState = useWardrobeItems(configured, filterState.filters);
  const sortState = useWardrobeSort(itemsState.items);
  const actions = useWardrobeItemActions(
    itemsState.setItems,
    itemsState.setTotal,
    itemsState.setError,
    filterState.filters.availability,
    filterState.filters.favoritesOnly,
  );

  function openForm(item: WardrobeItem | null) {
    setEditingItem(item);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingItem(null);
  }

  return {
    viewMode,
    setViewMode,
    formOpen,
    editingItem,
    openForm,
    closeForm,
    ...filterState,
    ...itemsState,
    ...sortState,
    actions,
  };
}
