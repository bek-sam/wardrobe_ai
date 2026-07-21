"use client";

import {
  CheckCircle,
  Heart,
  MagnifyingGlass,
  Plus,
  SpinnerGap,
  Sparkle,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { PreviewBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { OutfitCard, type OutfitPreview } from "@/features/outfits/components/OutfitCard";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import type { WardrobeItem, WardrobeItemRole } from "@/features/wardrobe/types";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };
type OutfitFilter = "all" | "favorite" | "worn" | "ai";
type OutfitItem = {
  item_id: string;
  role: WardrobeItemRole;
  sort_order: number;
};
type OutfitRecord = {
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
type OutfitListResponse = {
  outfits: OutfitRecord[];
  count: number;
  limit: number;
  offset: number;
};
type LiveWardrobeItem = WardrobeItem & { primary_image_url?: string | null };
type WardrobeListResponse = {
  items: LiveWardrobeItem[];
  count: number;
  limit: number;
  offset: number;
};
type FoundationMode = "separates" | "dress";
type OutfitSelections = Record<WardrobeItemRole, string>;

const roleColors: Record<WardrobeItemRole, { color: string; accent?: string }> = {
  top: { color: "#ddd4c2", accent: "#766e61" },
  bottom: { color: "#293647", accent: "#18202a" },
  dress: { color: "#455746", accent: "#253228" },
  layer: { color: "#9c7250", accent: "#5b412e" },
  shoes: { color: "#292724", accent: "#151412" },
  accessory: { color: "#8c493d", accent: "#5c2c27" },
};

const emptySelections: OutfitSelections = {
  top: "",
  bottom: "",
  dress: "",
  layer: "",
  shoes: "",
  accessory: "",
};

const roleOrder: WardrobeItemRole[] = ["top", "bottom", "dress", "layer", "shoes", "accessory"];

const roleLabels: Record<WardrobeItemRole, string> = {
  top: "Top",
  bottom: "Bottom",
  dress: "Dress",
  layer: "Outer layer",
  shoes: "Shoes",
  accessory: "Accessory",
};

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) return error.message;
  }
  return fallback;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, `The request failed (${response.status}).`));
  }
  return payload.data;
}

function asPreview(outfit: OutfitRecord): OutfitPreview {
  const pieces = [...(outfit.outfit_items ?? [])]
    .sort((first, second) => first.sort_order - second.sort_order)
    .filter((piece) => piece.role in roleColors)
    .map((piece) => ({ category: piece.role, ...roleColors[piece.role] }));
  const wearLogs = [...(outfit.wear_logs ?? [])].sort((first, second) =>
    second.worn_at.localeCompare(first.worn_at),
  );
  const wearSummary = wearLogs.length
    ? `Worn ${wearLogs.length} ${wearLogs.length === 1 ? "time" : "times"}; last worn ${new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(wearLogs[0]!.worn_at))}.`
    : null;
  return {
    id: outfit.id,
    name: outfit.name,
    occasion: outfit.occasion ?? (outfit.source === "ai" ? "AI-created look" : "Saved look"),
    detail: [
      outfit.explanation ??
        `${pieces.length} ${pieces.length === 1 ? "saved piece" : "saved pieces"} in this outfit.`,
      wearSummary,
    ]
      .filter(Boolean)
      .join(" "),
    pieces,
    favorite: outfit.favorite,
  };
}

function ManualOutfitDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (outfit: OutfitRecord) => void;
}) {
  const [items, setItems] = useState<LiveWardrobeItem[]>([]);
  const [availableCount, setAvailableCount] = useState(0);
  const [foundation, setFoundation] = useState<FoundationMode>("separates");
  const [selections, setSelections] = useState<OutfitSelections>(emptySelections);
  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [explanation, setExplanation] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      requestJson<WardrobeListResponse>(
        "/api/items?status=active&availability=available&limit=100",
        { signal: controller.signal },
      )
        .then((result) => {
          setItems(result.items);
          setAvailableCount(result.count);
          const roles = result.items.map((item) => resolveWardrobeItemRole(item));
          if ((!roles.includes("top") || !roles.includes("bottom")) && roles.includes("dress")) {
            setFoundation("dress");
          }
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
  }, [retry]);

  const itemsByRole = useMemo(() => {
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
  }, [items]);

  const activeRoles: WardrobeItemRole[] =
    foundation === "dress"
      ? ["dress", "layer", "shoes", "accessory"]
      : ["top", "bottom", "layer", "shoes", "accessory"];
  const selectedEntries = activeRoles
    .map((role) => ({
      role,
      item: items.find((item) => item.id === selections[role]) ?? null,
    }))
    .filter(
      (entry): entry is { role: WardrobeItemRole; item: LiveWardrobeItem } => entry.item !== null,
    );
  const unresolvedCount = items.filter((item) => !resolveWardrobeItemRole(item)).length;
  const missingFoundation =
    foundation === "dress" ? !selections.dress : !selections.top || !selections.bottom;
  const selectedIds = selectedEntries.map((entry) => entry.item.id);
  const hasDuplicate = new Set(selectedIds).size !== selectedIds.length;
  const validationMessage = !name.trim()
    ? "Name this outfit before saving."
    : missingFoundation
      ? foundation === "dress"
        ? "Select one dress for the outfit foundation."
        : "Select one top and one bottom for the outfit foundation."
      : hasDuplicate
        ? "Each garment can be selected only once."
        : null;

  function chooseFoundation(next: FoundationMode) {
    setFoundation(next);
    setSelections((current) =>
      next === "dress" ? { ...current, top: "", bottom: "" } : { ...current, dress: "" },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationMessage || saving) return;
    setSaving(true);
    setError(null);
    try {
      const saved = await requestJson<OutfitRecord>("/api/outfits", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          occasion: occasion.trim() || null,
          explanation: explanation.trim() || null,
          favorite,
          items: selectedEntries.map((entry, index) => ({
            item_id: entry.item.id,
            role: entry.role,
            sort_order: index,
          })),
        }),
      });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be saved.");
      setSaving(false);
    }
  }

  const closeSafely = () => {
    if (!saving) onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="manual-outfit-title"
        aria-modal="true"
        className="item-form-dialog outfit-builder-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="item-form-dialog__header">
          <div>
            <p className="eyebrow">Manual outfit</p>
            <h2 id="manual-outfit-title">Build from your wardrobe</h2>
          </div>
          <button
            aria-label="Close manual outfit builder"
            className="icon-button"
            disabled={saving}
            onClick={closeSafely}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="inline-feedback" role="status">
            <SpinnerGap className="spin" size={17} />
            <span>Loading available wardrobe pieces…</span>
          </div>
        ) : error && items.length === 0 ? (
          <div className="inline-feedback inline-feedback--error" role="alert">
            <WarningCircle size={17} />
            <span>{error}</span>
            <Button onClick={() => setRetry((value) => value + 1)} variant="ghost">
              Try again
            </Button>
          </div>
        ) : items.length === 0 ? (
          <section className="empty-state outfit-builder-empty">
            <span className="empty-state__icon">
              <Plus size={24} />
            </span>
            <h2>No available pieces yet</h2>
            <p>Add active wardrobe items and mark them available before building an outfit.</p>
            <div className="empty-state__action">
              <ButtonLink href="/wardrobe">Manage wardrobe</ButtonLink>
            </div>
          </section>
        ) : (
          <form className="form-grid" onSubmit={submit}>
            <div className="form-grid form-grid--two">
              <div className="form-field">
                <div className="form-field__label-row">
                  <label htmlFor="manual-outfit-name">Outfit name</label>
                  <span>Required</span>
                </div>
                <input
                  autoFocus
                  className="text-input"
                  disabled={saving}
                  id="manual-outfit-name"
                  maxLength={160}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Weekend layers"
                  required
                  value={name}
                />
              </div>
              <div className="form-field">
                <div className="form-field__label-row">
                  <label htmlFor="manual-outfit-occasion">Occasion</label>
                  <span>Optional</span>
                </div>
                <input
                  className="text-input"
                  disabled={saving}
                  id="manual-outfit-occasion"
                  maxLength={160}
                  onChange={(event) => setOccasion(event.target.value)}
                  placeholder="Work, dinner, travel…"
                  value={occasion}
                />
              </div>
            </div>

            <fieldset className="settings-fieldset" disabled={saving}>
              <legend>Choose a foundation</legend>
              <div className="choice-grid">
                <label className="choice-chip">
                  <input
                    checked={foundation === "separates"}
                    name="outfit-foundation"
                    onChange={() => chooseFoundation("separates")}
                    type="radio"
                  />
                  <span>Top + bottom</span>
                </label>
                <label className="choice-chip">
                  <input
                    checked={foundation === "dress"}
                    name="outfit-foundation"
                    onChange={() => chooseFoundation("dress")}
                    type="radio"
                  />
                  <span>Dress</span>
                </label>
              </div>
            </fieldset>

            <div className="outfit-builder-role-grid">
              {activeRoles.map((role) => {
                const required =
                  role === "dress" ||
                  (foundation === "separates" && (role === "top" || role === "bottom"));
                return (
                  <div className="form-field" key={role}>
                    <div className="form-field__label-row">
                      <label htmlFor={`manual-outfit-${role}`}>{roleLabels[role]}</label>
                      <span>{required ? "Required" : "Optional"}</span>
                    </div>
                    <select
                      className="select-input"
                      disabled={saving || itemsByRole[role].length === 0}
                      id={`manual-outfit-${role}`}
                      onChange={(event) =>
                        setSelections((current) => ({
                          ...current,
                          [role]: event.target.value,
                        }))
                      }
                      required={required}
                      value={selections[role]}
                    >
                      <option value="">
                        {itemsByRole[role].length
                          ? `Select ${required ? "a" : "an optional"} ${roleLabels[role].toLowerCase()}`
                          : `No available ${roleLabels[role].toLowerCase()}`}
                      </option>
                      {itemsByRole[role].map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.color_names[0] ? ` · ${item.color_names[0]}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {selectedEntries.length ? (
              <div className="outfit-builder-selected" aria-label="Selected outfit pieces">
                {selectedEntries.map(({ role, item }) => (
                  <article key={item.id}>
                    <GarmentArtwork
                      category={role}
                      color={item.primary_color_hex ?? roleColors[role].color}
                      compact
                    />
                    <div>
                      <span>{roleLabels[role]}</span>
                      <strong>{item.name}</strong>
                    </div>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor="manual-outfit-explanation">Notes</label>
                <span>Optional</span>
              </div>
              <textarea
                className="textarea-input"
                disabled={saving}
                id="manual-outfit-explanation"
                maxLength={1_500}
                onChange={(event) => setExplanation(event.target.value)}
                placeholder="Why this combination works, styling notes, or a dress-code reminder"
                rows={3}
                value={explanation}
              />
            </div>
            <label className="check-row">
              <input
                checked={favorite}
                disabled={saving}
                onChange={(event) => setFavorite(event.target.checked)}
                type="checkbox"
              />
              Save as a favorite outfit
            </label>

            {availableCount > items.length ? (
              <p className="outfit-builder-note">
                Showing the first {items.length} of {availableCount} available pieces.
              </p>
            ) : null}
            {unresolvedCount ? (
              <p className="outfit-builder-note">
                {unresolvedCount} {unresolvedCount === 1 ? "piece has" : "pieces have"} no outfit
                role yet and cannot be selected here. Add a layer role in Wardrobe to use it.
              </p>
            ) : null}
            {validationMessage ? <p className="outfit-builder-note">{validationMessage}</p> : null}
            {error ? (
              <p className="inline-feedback inline-feedback--error" role="alert">
                <WarningCircle size={16} /> {error}
              </p>
            ) : null}
            <div className="item-form-dialog__actions">
              <Button disabled={saving} onClick={closeSafely} type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={saving || validationMessage !== null} type="submit">
                {saving ? <SpinnerGap className="spin" size={16} /> : null}
                {saving ? "Saving…" : "Save outfit"}
              </Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function PreviewOutfits({ outfits }: { outfits: OutfitPreview[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Saved combinations"
        title="Outfits"
        description="Keep the looks that work, revisit favorites, and learn from what you actually wear."
        meta={<PreviewBadge />}
        actions={
          <>
            <Button disabled variant="secondary">
              <Plus size={16} /> Build manually
            </Button>
            <Button disabled>
              <Sparkle size={16} /> Generate outfits
            </Button>
          </>
        }
      />
      <DemoNotice>
        Preview mode: these looks are labeled samples. Configure Supabase to load and manage your
        saved outfits.
      </DemoNotice>
      <div className="outfit-tabs" role="tablist" aria-label="Preview outfit categories">
        <button className="is-active" role="tab" aria-selected="true" type="button">
          All looks <span>{outfits.length}</span>
        </button>
        <button disabled role="tab" aria-selected="false" type="button">
          <Heart size={15} /> Favorites
        </button>
        <button disabled role="tab" aria-selected="false" type="button">
          Worn history
        </button>
        <button disabled role="tab" aria-selected="false" type="button">
          AI created
        </button>
      </div>
      <div className="outfit-toolbar" aria-disabled="true">
        <label>
          <MagnifyingGlass size={17} />
          <span className="sr-only">Search preview outfits</span>
          <input disabled placeholder="Search outfits" type="search" />
        </label>
        <select aria-label="Preview occasion filter" disabled>
          <option>All occasions</option>
        </select>
        <select aria-label="Preview outfit sorting" disabled>
          <option>Recently saved</option>
        </select>
      </div>
      <section className="outfit-grid" aria-label="Sample saved outfits">
        {outfits.map((outfit) => (
          <OutfitCard key={outfit.id} outfit={outfit} sample />
        ))}
      </section>
      <section className="outfit-empty-prompt">
        <div>
          <Sparkle size={25} weight="light" />
          <div>
            <h2>More combinations are hiding in your closet.</h2>
            <p>Connect Supabase so recommendations can use your real wardrobe items.</p>
          </div>
        </div>
        <Button disabled variant="secondary">
          Explore combinations
        </Button>
      </section>
    </>
  );
}

export function OutfitsManager({
  configured,
  previewOutfits,
}: {
  configured: boolean;
  previewOutfits: OutfitPreview[];
}) {
  const [outfits, setOutfits] = useState<OutfitRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [activeFilter, setActiveFilter] = useState<OutfitFilter>("all");
  const [search, setSearch] = useState("");
  const [occasion, setOccasion] = useState("");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [builderOpen, setBuilderOpen] = useState(false);

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
    if (sort === "favorite") {
      return next.sort((a, b) => Number(b.favorite) - Number(a.favorite));
    }
    return next.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [activeFilter, occasion, outfits, search, sort]);

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

  if (!configured) return <PreviewOutfits outfits={previewOutfits} />;

  return (
    <>
      <PageHeader
        eyebrow="Saved combinations"
        title="Outfits"
        description="Keep the looks that work, revisit favorites, and learn from what you actually wear."
        actions={
          <>
            <Button onClick={() => setBuilderOpen(true)} variant="secondary">
              <Plus size={16} /> Build manually
            </Button>
            <ButtonLink href="/stylist">
              <Sparkle size={16} /> Generate outfits
            </ButtonLink>
          </>
        }
      />
      <div className="outfit-tabs" role="tablist" aria-label="Outfit categories">
        <button
          className={activeFilter === "all" ? "is-active" : ""}
          onClick={() => setActiveFilter("all")}
          role="tab"
          aria-selected={activeFilter === "all"}
          type="button"
        >
          All looks {activeFilter === "all" ? <span>{total}</span> : null}
        </button>
        <button
          className={activeFilter === "favorite" ? "is-active" : ""}
          onClick={() => setActiveFilter("favorite")}
          role="tab"
          aria-selected={activeFilter === "favorite"}
          type="button"
        >
          <Heart size={15} /> Favorites {activeFilter === "favorite" ? <span>{total}</span> : null}
        </button>
        <button
          className={activeFilter === "worn" ? "is-active" : ""}
          onClick={() => setActiveFilter("worn")}
          role="tab"
          aria-selected={activeFilter === "worn"}
          type="button"
        >
          Worn history {activeFilter === "worn" ? <span>{total}</span> : null}
        </button>
        <button
          className={activeFilter === "ai" ? "is-active" : ""}
          onClick={() => setActiveFilter("ai")}
          role="tab"
          aria-selected={activeFilter === "ai"}
          type="button"
        >
          AI created {activeFilter === "ai" ? <span>{total}</span> : null}
        </button>
      </div>
      <div className="outfit-toolbar">
        <label>
          <MagnifyingGlass size={17} />
          <span className="sr-only">Search outfits</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search outfits"
            type="search"
            value={search}
          />
        </label>
        <select
          aria-label="Filter outfits by occasion"
          onChange={(event) => setOccasion(event.target.value)}
          value={occasion}
        >
          <option value="">All occasions</option>
          {occasions.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Sort outfits"
          onChange={(event) => setSort(event.target.value)}
          value={sort}
        >
          <option value="recent">Recently saved</option>
          <option value="name">Name A–Z</option>
          <option value="favorite">Favorites first</option>
        </select>
      </div>
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} />
          <span>{error}</span>
          <Button onClick={() => setRetry((value) => value + 1)} variant="ghost">
            Try again
          </Button>
        </div>
      ) : null}
      {notice ? (
        <div className="inline-feedback inline-feedback--success" role="status">
          <CheckCircle size={17} />
          <span>{notice}</span>
        </div>
      ) : null}
      {loading ? (
        <div className="inline-feedback" role="status">
          <SpinnerGap className="spin" size={17} />
          <span>Loading saved outfits…</span>
        </div>
      ) : visibleOutfits.length ? (
        <section className="outfit-grid" aria-label="Saved outfits">
          {visibleOutfits.map((outfit) => {
            const busy = busyId === outfit.id;
            return (
              <OutfitCard
                actions={
                  <>
                    <Button
                      aria-label={`${outfit.favorite ? "Remove" : "Add"} ${outfit.name} ${outfit.favorite ? "from" : "to"} favorites`}
                      disabled={busy}
                      onClick={() =>
                        void mutate(outfit.id, async () => {
                          const updated = await requestJson<OutfitRecord>(
                            `/api/outfits/${outfit.id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({ favorite: !outfit.favorite }),
                            },
                          );
                          setOutfits((current) =>
                            current.map((candidate) =>
                              candidate.id === updated.id
                                ? { ...candidate, ...updated }
                                : candidate,
                            ),
                          );
                          if (activeFilter === "favorite" && !updated.favorite) {
                            setTotal((current) => Math.max(0, current - 1));
                          }
                          setNotice(
                            updated.favorite
                              ? "Outfit added to favorites."
                              : "Outfit removed from favorites.",
                          );
                        })
                      }
                      variant="ghost"
                    >
                      <Heart size={14} weight={outfit.favorite ? "fill" : "regular"} />
                      {outfit.favorite ? "Favorited" : "Favorite"}
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void mutate(outfit.id, async () => {
                          const idempotencyKey = `outfit-ui-${crypto.randomUUID()}`;
                          await requestJson<{ wear_log_id: string }>(
                            `/api/outfits/${outfit.id}/wear`,
                            {
                              method: "POST",
                              body: JSON.stringify({ idempotency_key: idempotencyKey }),
                            },
                          );
                          setOutfits((current) =>
                            current.map((candidate) =>
                              candidate.id === outfit.id
                                ? {
                                    ...candidate,
                                    wear_logs: [
                                      {
                                        id: crypto.randomUUID(),
                                        worn_at: new Date().toISOString(),
                                      },
                                      ...(candidate.wear_logs ?? []),
                                    ],
                                  }
                                : candidate,
                            ),
                          );
                          setNotice(`“${outfit.name}” was marked as worn.`);
                        })
                      }
                      variant="secondary"
                    >
                      {busy ? <SpinnerGap className="spin" size={14} /> : <CheckCircle size={14} />}
                      Mark worn
                    </Button>
                    <Button
                      aria-label={`Delete ${outfit.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `Delete “${outfit.name}”? This does not delete its wardrobe items.`,
                          )
                        )
                          return;
                        void mutate(outfit.id, async () => {
                          await requestJson<{ deleted: true; id: string }>(
                            `/api/outfits/${outfit.id}`,
                            {
                              method: "DELETE",
                            },
                          );
                          setOutfits((current) =>
                            current.filter((candidate) => candidate.id !== outfit.id),
                          );
                          setTotal((current) => Math.max(0, current - 1));
                          setNotice("Outfit deleted.");
                        });
                      }}
                      variant="ghost"
                    >
                      <Trash size={14} />
                    </Button>
                  </>
                }
                key={outfit.id}
                outfit={asPreview(outfit)}
              />
            );
          })}
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-state__icon">
            <Sparkle size={25} weight="light" />
          </span>
          <h2>{search || occasion ? "No matching outfits" : "No saved outfits yet"}</h2>
          <p>
            {search || occasion
              ? "Try another search or clear the occasion filter."
              : "Ask the stylist for a look made only from your saved, available wardrobe items."}
          </p>
          <div className="empty-state__action">
            {search || occasion ? (
              <Button
                onClick={() => {
                  setSearch("");
                  setOccasion("");
                }}
                variant="secondary"
              >
                Clear filters
              </Button>
            ) : (
              <div className="outfit-empty-actions">
                <Button onClick={() => setBuilderOpen(true)} variant="secondary">
                  <Plus size={16} /> Build manually
                </Button>
                <ButtonLink href="/stylist">Open the stylist</ButtonLink>
              </div>
            )}
          </div>
        </section>
      )}
      {builderOpen ? (
        <ManualOutfitDialog
          onClose={() => setBuilderOpen(false)}
          onSaved={(saved) => {
            setBuilderOpen(false);
            setNotice(`“${saved.name}” was saved to your outfits.`);
            if (activeFilter === "all") {
              setOutfits((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
              setTotal((current) => current + 1);
            } else {
              setActiveFilter("all");
            }
          }}
        />
      ) : null}
    </>
  );
}
