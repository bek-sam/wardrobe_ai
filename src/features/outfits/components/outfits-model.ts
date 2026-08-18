import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe";
import { requestJson } from "@/lib/api/request";
import type { GarmentCategory } from "@/components/garments/GarmentArtwork";
import { useEffect, useMemo, useState } from "react";
import { resolveWardrobeItemRole } from "@/features/wardrobe";
import type { FormEvent } from "react";

export type OutfitFilter = "all" | "favorite" | "worn" | "ai";

export type OutfitItem = { item_id: string; role: WardrobeItemRole; sort_order: number };

export type OutfitRecord = {
  id: string;
  name: string;
  source: "user" | "ai";
  occasion: string | null;
  explanation: string | null;
  favorite: boolean;
  created_at: string;
  outfit_items: OutfitItem[];
  wear_logs?: Array<{ id: string; worn_at: string }>;
};

export type OutfitListResponse = {
  outfits: OutfitRecord[];
  count: number;
  limit: number;
  offset: number;
};

export type LiveWardrobeItem = WardrobeItem & { primary_image_url?: string | null };

export type WardrobeListResponse = {
  items: LiveWardrobeItem[];
  count: number;
  limit: number;
  offset: number;
};

export type FoundationMode = "separates" | "dress";

export type OutfitSelections = Record<WardrobeItemRole, string>;

function appendWearLog(outfits: OutfitRecord[], outfitId: string): OutfitRecord[] {
  return outfits.map((candidate) =>
    candidate.id === outfitId
      ? {
          ...candidate,
          wear_logs: [
            { id: crypto.randomUUID(), worn_at: new Date().toISOString() },
            ...(candidate.wear_logs ?? []),
          ],
        }
      : candidate,
  );
}

type Setters = {
  setOutfits: (updater: (current: OutfitRecord[]) => OutfitRecord[]) => void;
  setTotal: (updater: (current: number) => number) => void;
  setNotice: (message: string) => void;
};

export async function toggleFavoriteOutfit(
  outfit: OutfitRecord,
  activeFilter: OutfitFilter,
  setters: Setters,
) {
  const updated = await requestJson<OutfitRecord>(`/api/outfits/${outfit.id}`, {
    method: "PATCH",
    body: JSON.stringify({ favorite: !outfit.favorite }),
  });
  setters.setOutfits((current) =>
    current.map((candidate) =>
      candidate.id === updated.id ? { ...candidate, ...updated } : candidate,
    ),
  );
  if (activeFilter === "favorite" && !updated.favorite)
    setters.setTotal((current) => Math.max(0, current - 1));
  setters.setNotice(
    updated.favorite ? "Outfit added to favorites." : "Outfit removed from favorites.",
  );
}

export async function markOutfitWorn(outfit: OutfitRecord, setters: Setters) {
  const idempotencyKey = `outfit-ui-${crypto.randomUUID()}`;
  await requestJson<{ wear_log_id: string }>(`/api/outfits/${outfit.id}/wear`, {
    method: "POST",
    body: JSON.stringify({ idempotency_key: idempotencyKey }),
  });
  setters.setOutfits((current) => appendWearLog(current, outfit.id));
  setters.setNotice(`“${outfit.name}” was marked as worn.`);
}

export async function deleteOutfit(outfit: OutfitRecord, setters: Setters) {
  await requestJson<{ deleted: true; id: string }>(`/api/outfits/${outfit.id}`, {
    method: "DELETE",
  });
  setters.setOutfits((current) => current.filter((candidate) => candidate.id !== outfit.id));
  setters.setTotal((current) => Math.max(0, current - 1));
  setters.setNotice("Outfit deleted.");
}

export interface OutfitPiece {
  category: GarmentCategory;
  color: string;
  accent?: string;
}

export interface OutfitPreview {
  id: string;
  name: string;
  occasion: string;
  detail: string;
  pieces: OutfitPiece[];
  favorite?: boolean;
}

export const roleColors: Record<WardrobeItemRole, { color: string; accent?: string }> = {
  top: { color: "#ddd4c2", accent: "#766e61" },
  bottom: { color: "#293647", accent: "#18202a" },
  dress: { color: "#455746", accent: "#253228" },
  layer: { color: "#9c7250", accent: "#5b412e" },
  shoes: { color: "#292724", accent: "#151412" },
  accessory: { color: "#8c493d", accent: "#5c2c27" },
};

export const emptySelections: OutfitSelections = {
  top: "",
  bottom: "",
  dress: "",
  layer: "",
  shoes: "",
  accessory: "",
};

export const roleOrder: WardrobeItemRole[] = [
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
];

export const roleLabels: Record<WardrobeItemRole, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  layer: "Outer layer",
  shoes: "Shoes",
  accessory: "Accessory",
};

function groupItemsByRole(items: LiveWardrobeItem[]): Record<WardrobeItemRole, LiveWardrobeItem[]> {
  const groups: Record<WardrobeItemRole, LiveWardrobeItem[]> = {
    top: [],
    bottom: [],
    dress: [],
    layer: [],
    shoes: [],
    accessory: [],
  };
  for (const item of items) {
    const role = resolveWardrobeItemRole(item);
    if (role) groups[role].push(item);
  }
  for (const role of roleOrder) {
    groups[role].sort((first, second) => first.name.localeCompare(second.name));
  }
  return groups;
}

export function useAvailableWardrobeItems(onLoaded: (items: LiveWardrobeItem[]) => void) {
  const [items, setItems] = useState<LiveWardrobeItem[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestJson<WardrobeListResponse>(
        "/api/items?status=active&availability=available&limit=100",
        {
          signal: controller.signal,
        },
      )
        .then((result) => {
          setItems(result.items);
          setAvailableCount(result.count);
          onLoaded(result.items);
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(
            caught instanceof Error ? caught.message : "Available wardrobe items could not load.",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retry]);

  const itemsByRole = useMemo(() => groupItemsByRole(items), [items]);

  return { items, availableCount, itemsByRole, loading, error, setRetry };
}

function buildManualOutfitPayload(form: {
  name: string;
  occasion: string;
  explanation: string;
  favorite: boolean;
  selectedEntries: Array<{ role: keyof OutfitSelections; item: { id: string } }>;
}) {
  return {
    name: form.name.trim(),
    occasion: form.occasion.trim() || null,
    explanation: form.explanation.trim() || null,
    favorite: form.favorite,
    items: form.selectedEntries.map((entry, index) => ({
      item_id: entry.item.id,
      role: entry.role,
      sort_order: index,
    })),
  };
}

export function useManualOutfitSubmit(
  onSaved: (outfit: OutfitRecord) => void,
  selectedEntries: Array<{ role: keyof OutfitSelections; item: { id: string } }>,
) {
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [explanation, setExplanation] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>, validationMessage: string | null) {
    event.preventDefault();
    if (validationMessage || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await requestJson<OutfitRecord>("/api/outfits", {
        method: "POST",
        body: JSON.stringify(
          buildManualOutfitPayload({ name, occasion, explanation, favorite, selectedEntries }),
        ),
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be saved.");
      setSaving(false);
    }
  }

  return {
    name,
    setName,
    occasion,
    setOccasion,
    explanation,
    setExplanation,
    favorite,
    setFavorite,
    saving,
    error,
    submit,
  };
}

export function useOutfitSelections(items: LiveWardrobeItem[]) {
  const [foundation, setFoundation] = useState<FoundationMode>("separates");
  const [selections, setSelections] = useState<OutfitSelections>(emptySelections);

  function chooseFoundation(next: FoundationMode) {
    setFoundation(next);
    setSelections((current) =>
      next === "dress" ? { ...current, top: "", bottom: "" } : { ...current, dress: "" },
    );
  }

  const activeRoles: WardrobeItemRole[] =
    foundation === "dress"
      ? ["dress", "layer", "shoes", "accessory"]
      : ["top", "bottom", "layer", "shoes", "accessory"];
  const selectedEntries = activeRoles
    .map((role) => ({ role, item: items.find((item) => item.id === selections[role]) ?? null }))
    .filter(
      (entry): entry is { role: WardrobeItemRole; item: LiveWardrobeItem } => entry.item !== null,
    );
  const unresolvedCount = items.filter((item) => !resolveWardrobeItemRole(item)).length;
  const missingFoundation =
    foundation === "dress" ? !selections.dress : !selections.top || !selections.bottom;
  const selectedIds = selectedEntries.map((entry) => entry.item.id);
  const hasDuplicate = new Set(selectedIds).size !== selectedIds.length;

  return {
    foundation,
    setFoundation,
    chooseFoundation,
    selections,
    setSelections,
    activeRoles,
    selectedEntries,
    unresolvedCount,
    missingFoundation,
    hasDuplicate,
  };
}

function outfitValidationMessage(
  name: string,
  missingFoundation: boolean,
  foundation: FoundationMode,
  hasDuplicate: boolean,
): string | null {
  if (!name.trim()) return "Name this outfit before saving.";
  if (missingFoundation) {
    return foundation === "dress"
      ? "Select one dress for the outfit foundation."
      : "Select one top and one bottom for the outfit foundation.";
  }
  if (hasDuplicate) return "Each garment can be selected only once.";
  return null;
}

export function useManualOutfitDialog(onSaved: (outfit: OutfitRecord) => void) {
  const wardrobe = useAvailableWardrobeItems(() => {});
  const selections = useOutfitSelections(wardrobe.items);
  const form = useManualOutfitSubmit(onSaved, selections.selectedEntries);

  useEffect(() => {
    if (!wardrobe.items.length) return;
    const roles = wardrobe.items.map((item) => resolveWardrobeItemRole(item));
    if ((!roles.includes("top") || !roles.includes("bottom")) && roles.includes("dress")) {
      selections.setFoundation("dress");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wardrobe.items]);

  const validationMessage = outfitValidationMessage(
    form.name,
    selections.missingFoundation,
    selections.foundation,
    selections.hasDuplicate,
  );

  return { wardrobe, selections, form, validationMessage };
}

export function useOutfitCardActions(
  setOutfits: (updater: (current: OutfitRecord[]) => OutfitRecord[]) => void,
  setTotal: (updater: (current: number) => number) => void,
  activeFilter: OutfitFilter,
) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function mutate(outfitId: string, operation: () => Promise<void>) {
    setBusyId(outfitId);
    setError(null);
    setNotice(null);
    try {
      await operation();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  const setters = { setOutfits, setTotal, setNotice };
  return {
    busyId,
    error,
    notice,
    setNotice,
    toggleFavorite: (outfit: OutfitRecord) =>
      mutate(outfit.id, () => toggleFavoriteOutfit(outfit, activeFilter, setters)),
    markWorn: (outfit: OutfitRecord) => mutate(outfit.id, () => markOutfitWorn(outfit, setters)),
    remove: (outfit: OutfitRecord) => {
      if (!window.confirm(`Delete “${outfit.name}”? This does not delete its wardrobe items.`))
        return;
      void mutate(outfit.id, () => deleteOutfit(outfit, setters));
    },
  };
}

export function useOutfitsFetch(configured: boolean, activeFilter: OutfitFilter) {
  const [outfits, setOutfits] = useState<OutfitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ limit: "100" });
    if (activeFilter === "favorite") query.set("favorite", "true");
    if (activeFilter === "worn") query.set("worn", "true");
    if (activeFilter === "ai") query.set("source", "ai");
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestJson<OutfitListResponse>(`/api/outfits?${query}`, { signal: controller.signal })
        .then((result) => {
          setOutfits(result.outfits);
          setTotal(result.count);
        })
        .catch((caught) => {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
          setError(caught instanceof Error ? caught.message : "Your outfits could not be loaded.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 0);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeFilter, configured, retry]);

  return { outfits, setOutfits, total, setTotal, loading, error, setError, retry, setRetry };
}

export function useOutfitsFilterSort(outfits: OutfitRecord[], activeFilter: OutfitFilter) {
  const [search, setSearch] = useState("");
  const [occasion, setOccasion] = useState("");
  const [sort, setSort] = useState("recent");

  const occasions = useMemo(
    () =>
      [
        ...new Set(
          outfits.map((outfit) => outfit.occasion).filter((value): value is string => !!value),
        ),
      ].sort((first, second) => first.localeCompare(second)),
    [outfits],
  );

  const visibleOutfits = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const next = outfits.filter((outfit) => {
      if (activeFilter === "favorite" && !outfit.favorite) return false;
      if (activeFilter === "worn" && !outfit.wear_logs?.length) return false;
      if (occasion && outfit.occasion !== occasion) return false;
      if (!normalizedSearch) return true;
      return [outfit.name, outfit.occasion, outfit.explanation]
        .filter((value): value is string => !!value)
        .some((value) => value.toLowerCase().includes(normalizedSearch));
    });
    if (sort === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "favorite") return next.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [activeFilter, occasion, outfits, search, sort]);

  return { search, setSearch, occasion, setOccasion, sort, setSort, occasions, visibleOutfits };
}

export function useOutfitsManagerState(configured: boolean) {
  const [activeFilter, setActiveFilter] = useState<OutfitFilter>("all");
  const [builderOpen, setBuilderOpen] = useState(false);

  const fetchState = useOutfitsFetch(configured, activeFilter);
  const filterSort = useOutfitsFilterSort(fetchState.outfits, activeFilter);
  const actions = useOutfitCardActions(fetchState.setOutfits, fetchState.setTotal, activeFilter);

  return {
    activeFilter,
    setActiveFilter,
    builderOpen,
    setBuilderOpen,
    ...fetchState,
    ...filterSort,
    actions,
  };
}
