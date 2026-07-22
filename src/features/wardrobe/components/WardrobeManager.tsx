"use client";

import {
  FunnelSimple,
  GridFour,
  Heart,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Rows,
  SpinnerGap,
  Trash,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PreviewBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import type {
  AvailabilityStatus,
  WardrobeItem,
  WardrobeItemRole,
  WardrobeItemStatus,
} from "@/features/wardrobe/types";

import { CompilationStatus } from "./CompilationStatus";
import { GarmentArtwork, type GarmentCategory } from "./GarmentArtwork";
import { WardrobeItemCard, type WardrobePreviewItem } from "./WardrobeItemCard";

type WardrobeListResponse = {
  items: LiveWardrobeItem[];
  count: number;
  limit: number;
  offset: number;
};

type LiveWardrobeItem = WardrobeItem & { primary_image_url?: string | null };

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

type ItemFormValues = {
  name: string;
  category: string;
  brand: string;
  primaryColorHex: string;
  colorNames: string;
  layerRole: WardrobeItemRole | "";
  notes: string;
};

const categoryFilters = [
  { label: "All pieces", value: "" },
  { label: "Tops", value: "tops" },
  { label: "Bottoms", value: "bottoms" },
  { label: "Dresses", value: "dresses" },
  { label: "Layers", value: "outerwear" },
  { label: "Shoes", value: "shoes" },
  { label: "Accessories", value: "accessories" },
] as const;

const categoryOptions = [
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

const availabilityOptions: Array<{ label: string; value: AvailabilityStatus }> = [
  { label: "Available", value: "available" },
  { label: "In laundry", value: "laundry" },
  { label: "Packed", value: "packed" },
  { label: "Loaned out", value: "loaned" },
  { label: "Needs repair", value: "repair" },
];

const emptyForm: ItemFormValues = {
  name: "",
  category: "tops",
  brand: "",
  primaryColorHex: "#8b7d6b",
  colorNames: "",
  layerRole: "top",
  notes: "",
};

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: { message?: unknown } }).error;
    if (typeof error?.message === "string" && error.message.trim()) return error.message;
  }
  return fallback;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
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

// Best-effort nudge: a database trigger already durably queues a wardrobe
// compilation job on any relevant item change, so this call is purely a
// latency optimization to process it promptly. Safe to ignore if it fails.
function triggerWardrobeCompile() {
  fetch("/api/wardrobe/compile", { method: "POST" }).catch(() => {});
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function artworkCategory(item: WardrobeItem): GarmentCategory {
  if (item.layer_role === "bottom" || item.category === "bottoms") return "bottom";
  if (item.layer_role === "dress" || item.category === "dresses") return "dress";
  if (item.layer_role === "layer" || item.category === "outerwear") return "layer";
  if (item.layer_role === "shoes" || item.category === "shoes") return "shoes";
  if (
    item.layer_role === "accessory" ||
    ["accessories", "bags"].includes(item.category.toLowerCase())
  ) {
    return "accessory";
  }
  return "top";
}

function roleForCategory(category: string): WardrobeItemRole | "" {
  return (
    ({
      tops: "top",
      bottoms: "bottom",
      dresses: "dress",
      outerwear: "layer",
      shoes: "shoes",
      accessories: "accessory",
      bags: "accessory",
    }[category] as WardrobeItemRole | undefined) ?? ""
  );
}

function formFromItem(item: WardrobeItem): ItemFormValues {
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

function itemPayload(values: ItemFormValues) {
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

function PreviewWardrobe({ items }: { items: WardrobePreviewItem[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Search, filter, and understand every piece you own."
        meta={<PreviewBadge />}
        actions={
          <>
            <ButtonLink href="/wardrobe/import">
              <UploadSimple size={16} /> Add by photo
            </ButtonLink>
            <Button variant="secondary" disabled>
              <Plus size={16} /> Add manually
            </Button>
          </>
        }
      />
      <DemoNotice>
        These garments are labeled samples because Supabase is not configured. Connect Supabase to
        load and manage your private wardrobe.
      </DemoNotice>
      <div className="wardrobe-toolbar">
        <label className="search-field">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Search preview wardrobe</span>
          <input type="search" placeholder="Search by name, brand, color, or detail" disabled />
        </label>
        <Button variant="secondary" disabled>
          <FunnelSimple size={17} /> Filters
        </Button>
        <div className="view-switch" aria-label="Wardrobe view">
          <button className="is-active" type="button" aria-label="Grid view" aria-pressed="true">
            <GridFour size={17} />
          </button>
          <button type="button" aria-label="List view" aria-pressed="false" disabled>
            <Rows size={17} />
          </button>
        </div>
      </div>
      <div className="wardrobe-results">
        <p>{items.length} sample pieces</p>
      </div>
      <section className="wardrobe-grid" aria-label="Sample wardrobe items">
        {items.map((item) => (
          <WardrobeItemCard item={item} key={item.id} sample />
        ))}
      </section>
    </>
  );
}

function ItemFormDialog({
  item,
  onClose,
  onSaved,
  onWarning,
}: {
  item: WardrobeItem | null;
  onClose: () => void;
  onSaved: (item: WardrobeItem) => void;
  onWarning: (message: string) => void;
}) {
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
      if (image) {
        try {
          const imageData = new FormData();
          imageData.set("file", image);
          const response = await fetch(`/api/items/${saved.id}/images`, {
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
      onSaved(saved);
      triggerWardrobeCompile();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The item could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="item-form-title"
        aria-modal="true"
        className="item-form-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="item-form-dialog__header">
          <div>
            <p className="eyebrow">{editing ? "Edit piece" : "Manual entry"}</p>
            <h2 id="item-form-title">{editing ? "Update garment" : "Add a garment"}</h2>
          </div>
          <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <form className="form-grid" onSubmit={submit}>
          <div className="form-field">
            <div className="form-field__label-row">
              <label htmlFor="item-name">Name</label>
              <span>Required</span>
            </div>
            <input
              autoFocus
              className="text-input"
              id="item-name"
              maxLength={160}
              onChange={(event) => setField("name", event.target.value)}
              required
              value={values.name}
            />
          </div>
          <div className="form-field">
            <div className="form-field__label-row">
              <label htmlFor="item-image">Garment image</label>
              <span>Optional · JPEG, PNG, or WebP · 4 MB max</span>
            </div>
            <input
              accept="image/jpeg,image/png,image/webp"
              id="item-image"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
              type="file"
            />
          </div>
          <div className="form-grid form-grid--two">
            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor="item-category">Category</label>
              </div>
              <select
                className="select-input"
                id="item-category"
                onChange={(event) => {
                  const category = event.target.value;
                  setValues((current) => ({
                    ...current,
                    category,
                    layerRole: roleForCategory(category),
                  }));
                }}
                value={values.category}
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {titleCase(category)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor="item-brand">Brand</label>
                <span>Optional</span>
              </div>
              <input
                className="text-input"
                id="item-brand"
                maxLength={120}
                onChange={(event) => setField("brand", event.target.value)}
                value={values.brand}
              />
            </div>
          </div>
          <div className="form-grid form-grid--two">
            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor="item-color">Primary color</label>
              </div>
              <div className="optional-color-row">
                <input
                  aria-label="Choose primary color"
                  id="item-color"
                  disabled={!values.primaryColorHex}
                  onChange={(event) => setField("primaryColorHex", event.target.value)}
                  type="color"
                  value={values.primaryColorHex || "#8b7d6b"}
                />
                <label className="check-row">
                  <input
                    checked={Boolean(values.primaryColorHex)}
                    onChange={(event) =>
                      setField("primaryColorHex", event.target.checked ? "#8b7d6b" : "")
                    }
                    type="checkbox"
                  />
                  Include
                </label>
              </div>
            </div>
            <div className="form-field">
              <div className="form-field__label-row">
                <label htmlFor="item-color-names">Color names</label>
                <span>Comma separated</span>
              </div>
              <input
                className="text-input"
                id="item-color-names"
                onChange={(event) => setField("colorNames", event.target.value)}
                placeholder="navy, cream"
                value={values.colorNames}
              />
            </div>
          </div>
          <div className="form-field">
            <div className="form-field__label-row">
              <label htmlFor="item-notes">Notes</label>
              <span>Optional</span>
            </div>
            <textarea
              className="textarea-input"
              id="item-notes"
              maxLength={2000}
              onChange={(event) => setField("notes", event.target.value)}
              placeholder="Fit, care, styling, or purchase notes"
              value={values.notes}
            />
          </div>
          {error ? (
            <p className="inline-feedback inline-feedback--error" role="alert">
              <WarningCircle size={16} /> {error}
            </p>
          ) : null}
          <div className="item-form-dialog__actions">
            <Button onClick={onClose} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={saving || !values.name.trim()} type="submit">
              {saving ? <SpinnerGap className="spin" size={16} /> : null}
              {editing ? "Save changes" : "Add to wardrobe"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function LiveWardrobeCard({
  item,
  busy,
  onEdit,
  onFavorite,
  onAvailability,
  onDelete,
}: {
  item: LiveWardrobeItem;
  busy: boolean;
  onEdit: () => void;
  onFavorite: () => void;
  onAvailability: (availability: AvailabilityStatus) => void;
  onDelete: () => void;
}) {
  const meta = [item.brand, item.color_names.join(" · ")].filter(Boolean).join(" · ");
  return (
    <article className="wardrobe-card wardrobe-card--live">
      <Link
        aria-label={`Open ${item.name}`}
        className="wardrobe-card__image wardrobe-card__image-button"
        href={`/wardrobe/${item.id}`}
      >
        {item.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className="wardrobe-card__photo" src={item.primary_image_url} />
        ) : (
          <GarmentArtwork
            category={artworkCategory(item)}
            color={item.primary_color_hex ?? "#9c968b"}
            accent={item.secondary_color_hex ?? undefined}
          />
        )}
      </Link>
      <button
        aria-label={item.favorite ? `Remove ${item.name} from favorites` : `Favorite ${item.name}`}
        aria-pressed={item.favorite}
        className={`wardrobe-card__favorite-button${item.favorite ? " is-active" : ""}`}
        disabled={busy}
        onClick={onFavorite}
        type="button"
      >
        <Heart size={17} weight={item.favorite ? "fill" : "regular"} />
      </button>
      <div className="wardrobe-card__body">
        <div>
          <p>{titleCase(item.category)}</p>
          <h3>
            <Link href={`/wardrobe/${item.id}`}>{item.name}</Link>
          </h3>
        </div>
        <span className="wardrobe-card__meta">{meta || "No brand or color details yet"}</span>
        <div className="wardrobe-card__controls">
          <label>
            <span className="sr-only">Availability for {item.name}</span>
            <select
              aria-label={`Availability for ${item.name}`}
              disabled={busy}
              onChange={(event) => onAvailability(event.target.value as AvailabilityStatus)}
              value={item.availability_status}
            >
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button aria-label={`Edit ${item.name}`} disabled={busy} onClick={onEdit} type="button">
            <PencilSimple size={14} /> Edit
          </button>
          <button
            aria-label={`Delete ${item.name}`}
            className="danger-link"
            disabled={busy}
            onClick={onDelete}
            type="button"
          >
            <Trash size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function WardrobeManager({
  configured,
  previewItems,
}: {
  configured: boolean;
  previewItems: WardrobePreviewItem[];
}) {
  const [items, setItems] = useState<LiveWardrobeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState<AvailabilityStatus | "">("");
  const [itemStatus, setItemStatus] = useState<WardrobeItemStatus | "">("active");
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [season, setSeason] = useState("");
  const [occasion, setOccasion] = useState("");
  const [formality, setFormality] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams({ limit: "100" });
      if (search.trim()) query.set("search", search.trim());
      if (category) query.set("category", category);
      if (availability) query.set("availability", availability);
      if (itemStatus) query.set("status", itemStatus);
      if (brand.trim()) query.set("brand", brand.trim());
      if (color.trim()) query.set("color", color.trim());
      if (season) query.set("season", season);
      if (occasion) query.set("occasion", occasion);
      if (formality) query.set("formality", formality);
      if (favoritesOnly) query.set("favorite", "true");
      try {
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
  }, [
    availability,
    brand,
    category,
    color,
    configured,
    favoritesOnly,
    formality,
    itemStatus,
    occasion,
    retry,
    search,
    season,
  ]);

  const sortedItems = useMemo(() => {
    const next = [...items];
    if (sort === "name") return next.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "worn") return next.sort((a, b) => b.wear_count - a.wear_count);
    return next;
  }, [items, sort]);

  const activeFilterCount =
    Number(Boolean(availability)) +
    Number(itemStatus !== "active") +
    Number(Boolean(brand.trim())) +
    Number(Boolean(color.trim())) +
    Number(Boolean(season)) +
    Number(Boolean(occasion)) +
    Number(Boolean(formality)) +
    Number(favoritesOnly);
  const hasQuery = Boolean(
    search.trim() ||
    category ||
    availability ||
    itemStatus !== "active" ||
    brand.trim() ||
    color.trim() ||
    season ||
    occasion ||
    formality ||
    favoritesOnly,
  );

  const mutate = useCallback(
    async <T,>(itemId: string, path: string, init: RequestInit, apply: (data: T) => void) => {
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
    [],
  );

  function clearAdvancedFilters() {
    setAvailability("");
    setItemStatus("active");
    setBrand("");
    setColor("");
    setSeason("");
    setOccasion("");
    setFormality("");
    setFavoritesOnly(false);
  }

  function clearAllFilters() {
    setSearch("");
    setCategory("");
    clearAdvancedFilters();
  }

  if (!configured) return <PreviewWardrobe items={previewItems} />;

  return (
    <>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Search, filter, and understand every piece you own."
        actions={
          <>
            <ButtonLink href="/wardrobe/import">
              <UploadSimple size={16} /> Add by photo
            </ButtonLink>
            <Button
              onClick={() => {
                setEditingItem(null);
                setFormOpen(true);
              }}
              variant="secondary"
            >
              <Plus size={16} /> Add manually
            </Button>
          </>
        }
      />
      <div className="wardrobe-toolbar">
        <label className="search-field">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <span className="sr-only">Search wardrobe</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by garment name"
            type="search"
            value={search}
          />
        </label>
        <Button
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((current) => !current)}
          variant="secondary"
        >
          <FunnelSimple size={17} /> Filters
          {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
        </Button>
        <div className="view-switch" aria-label="Wardrobe view">
          <button
            aria-label="Grid view"
            aria-pressed={viewMode === "grid"}
            className={viewMode === "grid" ? "is-active" : ""}
            onClick={() => setViewMode("grid")}
            type="button"
          >
            <GridFour size={17} />
          </button>
          <button
            aria-label="Compact list view"
            aria-pressed={viewMode === "list"}
            className={viewMode === "list" ? "is-active" : ""}
            onClick={() => setViewMode("list")}
            type="button"
          >
            <Rows size={17} />
          </button>
        </div>
      </div>
      {filtersOpen ? (
        <div className="wardrobe-filter-panel">
          <label className="form-field">
            <span>Availability</span>
            <select
              className="select-input"
              onChange={(event) => setAvailability(event.target.value as AvailabilityStatus | "")}
              value={availability}
            >
              <option value="">Any availability</option>
              {availabilityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Item status</span>
            <select
              className="select-input"
              onChange={(event) => setItemStatus(event.target.value as WardrobeItemStatus | "")}
              value={itemStatus}
            >
              <option value="">Any status</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="donated">Donated</option>
              <option value="sold">Sold</option>
              <option value="lost">Lost</option>
            </select>
          </label>
          <label className="form-field">
            <span>Brand</span>
            <input
              className="text-input"
              onChange={(event) => setBrand(event.target.value)}
              placeholder="Any brand"
              type="search"
              value={brand}
            />
          </label>
          <label className="form-field">
            <span>Color name</span>
            <input
              className="text-input"
              onChange={(event) => setColor(event.target.value)}
              placeholder="navy"
              type="search"
              value={color}
            />
          </label>
          <label className="form-field">
            <span>Season</span>
            <select
              className="select-input"
              onChange={(event) => setSeason(event.target.value)}
              value={season}
            >
              <option value="">Any season</option>
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
              <option value="fall">Fall</option>
              <option value="winter">Winter</option>
              <option value="year-round">Year-round</option>
            </select>
          </label>
          <label className="form-field">
            <span>Occasion</span>
            <select
              className="select-input"
              onChange={(event) => setOccasion(event.target.value)}
              value={occasion}
            >
              <option value="">Any occasion</option>
              <option value="work">Work</option>
              <option value="casual">Casual</option>
              <option value="dinner">Dinner</option>
              <option value="formal">Formal</option>
              <option value="travel">Travel</option>
              <option value="outdoors">Outdoors</option>
              <option value="athletic">Athletic</option>
            </select>
          </label>
          <label className="form-field">
            <span>Formality</span>
            <select
              className="select-input"
              onChange={(event) => setFormality(event.target.value)}
              value={formality}
            >
              <option value="">Any level</option>
              <option value="1">1 · Very casual</option>
              <option value="2">2 · Casual</option>
              <option value="3">3 · Balanced</option>
              <option value="4">4 · Polished</option>
              <option value="5">5 · Formal</option>
            </select>
          </label>
          <label className="check-row wardrobe-filter-panel__check">
            <input
              checked={favoritesOnly}
              onChange={(event) => setFavoritesOnly(event.target.checked)}
              type="checkbox"
            />
            Favorites only
          </label>
          <Button onClick={clearAdvancedFilters} variant="ghost">
            Clear filters
          </Button>
        </div>
      ) : null}
      <div className="category-tabs" role="tablist" aria-label="Wardrobe categories">
        {categoryFilters.map((filter) => (
          <button
            className={category === filter.value ? "is-active" : ""}
            key={filter.value || "all"}
            role="tab"
            aria-selected={category === filter.value}
            onClick={() => setCategory(filter.value)}
            type="button"
          >
            {filter.label}
            {!filter.value && !hasQuery ? <span>{total}</span> : null}
          </button>
        ))}
      </div>
      {hasQuery ? (
        <div className="active-filters">
          {availability ? (
            <span>
              {availabilityOptions.find((option) => option.value === availability)?.label}
              <button
                aria-label="Remove availability filter"
                onClick={() => setAvailability("")}
                type="button"
              >
                ×
              </button>
            </span>
          ) : null}
          {favoritesOnly ? (
            <span>
              Favorites
              <button
                aria-label="Remove favorites filter"
                onClick={() => setFavoritesOnly(false)}
                type="button"
              >
                ×
              </button>
            </span>
          ) : null}
          <button onClick={clearAllFilters} type="button">
            Clear all
          </button>
        </div>
      ) : null}
      <div className="wardrobe-results">
        <p>{loading ? "Loading wardrobe…" : `${total} ${total === 1 ? "piece" : "pieces"}`}</p>
        <CompilationStatus configured={configured} />
        <select
          aria-label="Sort wardrobe"
          onChange={(event) => setSort(event.target.value)}
          value={sort}
        >
          <option value="recent">Recently added</option>
          <option value="worn">Most worn</option>
          <option value="name">Name A–Z</option>
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
      {loading ? (
        <section
          aria-busy="true"
          aria-label="Loading wardrobe"
          className={`wardrobe-grid${viewMode === "list" ? " wardrobe-grid--list" : ""}`}
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div className="wardrobe-card wardrobe-card--skeleton" key={index}>
              <span />
              <i />
              <i />
            </div>
          ))}
        </section>
      ) : sortedItems.length ? (
        <section
          aria-label="Wardrobe items"
          className={`wardrobe-grid${viewMode === "list" ? " wardrobe-grid--list" : ""}`}
        >
          {sortedItems.map((item) => (
            <LiveWardrobeCard
              busy={busyItemId === item.id}
              item={item}
              key={item.id}
              onAvailability={(nextAvailability) =>
                void mutate<{ id: string; availability_status: AvailabilityStatus }>(
                  item.id,
                  `/api/items/${item.id}/availability`,
                  {
                    method: "POST",
                    body: JSON.stringify({ availability_status: nextAvailability }),
                  },
                  (data) => {
                    const leavesCurrentFilter =
                      Boolean(availability) && data.availability_status !== availability;
                    setItems((current) =>
                      leavesCurrentFilter
                        ? current.filter((entry) => entry.id !== data.id)
                        : current.map((entry) =>
                            entry.id === data.id
                              ? { ...entry, availability_status: data.availability_status }
                              : entry,
                          ),
                    );
                    if (leavesCurrentFilter) setTotal((current) => Math.max(0, current - 1));
                  },
                )
              }
              onDelete={() => {
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
              }}
              onEdit={() => {
                setEditingItem(item);
                setFormOpen(true);
              }}
              onFavorite={() =>
                void mutate<{ id: string; favorite: boolean }>(
                  item.id,
                  `/api/items/${item.id}/favorite`,
                  { method: "POST", body: JSON.stringify({ favorite: !item.favorite }) },
                  (data) => {
                    const leavesCurrentFilter = favoritesOnly && !data.favorite;
                    setItems((current) =>
                      leavesCurrentFilter
                        ? current.filter((entry) => entry.id !== data.id)
                        : current.map((entry) =>
                            entry.id === data.id ? { ...entry, favorite: data.favorite } : entry,
                          ),
                    );
                    if (leavesCurrentFilter) setTotal((current) => Math.max(0, current - 1));
                  },
                )
              }
            />
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <span className="empty-state__icon">
            <Plus size={24} />
          </span>
          <h2>{hasQuery ? "No matching pieces" : "Your wardrobe is ready"}</h2>
          <p>
            {hasQuery
              ? "Try clearing a filter or searching with a different garment name."
              : "Add a piece manually, or import a photo and review every detected garment before saving."}
          </p>
          <div className="empty-state__action">
            {hasQuery ? (
              <Button onClick={clearAllFilters} variant="secondary">
                Clear filters
              </Button>
            ) : (
              <Button onClick={() => setFormOpen(true)}>
                <Plus size={16} /> Add first piece
              </Button>
            )}
          </div>
        </section>
      )}
      {formOpen ? (
        <ItemFormDialog
          item={editingItem}
          onClose={() => {
            setFormOpen(false);
            setEditingItem(null);
          }}
          onSaved={() => {
            setFormOpen(false);
            setEditingItem(null);
            setRetry((value) => value + 1);
          }}
          onWarning={setError}
        />
      ) : null}
    </>
  );
}
