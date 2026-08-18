"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { requestJson } from "@/lib/api/request";
import { compilationHeadline } from "./wardrobe-model";
import { formatLastCompiled } from "./wardrobe-model";
import type { CompileStatusResponse, RecompileResponse } from "./wardrobe-model";
import type { WardrobeItem } from "@/features/wardrobe";
import type { ItemDetail, ItemEditValues } from "./wardrobe-model";
import { AVAILABILITY_LABELS } from "@/features/wardrobe";
import type { AvailabilityStatus } from "@/features/wardrobe";
import { MagicWand, PencilSimple } from "@phosphor-icons/react";
import { Heart } from "@phosphor-icons/react";
import type { ItemFormValues } from "./wardrobe-model";
import { categoryOptions } from "./wardrobe-model";
import { titleCase } from "./wardrobe-model";
import { useItemForm } from "./wardrobe-model";
import { X } from "@phosphor-icons/react";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { Trash } from "@phosphor-icons/react";
import { AVAILABILITY_OPTIONS } from "@/features/wardrobe";
import Link from "next/link";
import type { LiveWardrobeItem } from "./wardrobe-model";
import { artworkCategory } from "./wardrobe-model";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { Check } from "@phosphor-icons/react";
import type { ResearchRun } from "./wardrobe-model";
import { Badge } from "@/components/ui";
import { Card } from "@/components/ui";
import type { ResearchCardProps } from "./wardrobe-model";
import { startResearch } from "./wardrobe-model";
import { hasActiveQuery } from "./wardrobe-model";
import type { WardrobeFilters } from "./wardrobe-model";
import { categoryFilters } from "./wardrobe-model";
import type { WardrobeItemStatus } from "@/features/wardrobe";
import { FORMALITY_OPTIONS, OCCASION_OPTIONS, SEASON_OPTIONS } from "./wardrobe-model";
import { ArrowLeft } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useItemDetail } from "./wardrobe-model";
import type { WardrobeResultsSectionProps } from "./wardrobe-model";
import { Plus } from "@phosphor-icons/react";
import { FunnelSimple, GridFour, MagnifyingGlass, Rows } from "@phosphor-icons/react";
import { PageHeader } from "@/components/ui";
import { useWardrobeManagerState } from "./wardrobe-model";
import type { GarmentPreviewItem } from "@/components/garments/GarmentArtwork";
import { activeFilterCount } from "./wardrobe-model";
import type { WardrobeManagerFiltersProps } from "./wardrobe-model";
import { PreviewBadge } from "@/components/ui";
import { DemoNotice } from "@/components/ui";
import { UploadSimple } from "@phosphor-icons/react";
import { ButtonLink } from "@/components/ui";

function useCompilationStatus(configured: boolean) {
  const [status, setStatus] = useState<CompileStatusResponse | null>(null);
  const [recompiling, setRecompiling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      setStatus(await requestJson<CompileStatusResponse>("/api/wardrobe/compile"));
    } catch {
      // The outfit-library status is a non-critical widget; ignore failures.
    }
  }, [configured]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);

  async function recompileNow() {
    setRecompiling(true);
    setNotice(null);
    try {
      const result = await requestJson<RecompileResponse>("/api/wardrobe/compile", {
        method: "POST",
      });
      setNotice(
        result.status === "up_to_date"
          ? "Your outfit library is already up to date."
          : result.status === "running"
            ? "A recompile is already in progress."
            : "Recompiling your outfit library…",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Your outfit library could not be recompiled right now.",
      );
    } finally {
      setRecompiling(false);
      void refresh();
    }
  }

  return { status, recompiling, notice, recompileNow };
}

export function CompilationStatus({ configured }: { configured: boolean }) {
  const { status, recompiling, notice, recompileNow } = useCompilationStatus(configured);
  if (!configured) return null;

  const jobStatus = status?.latest_job_status ?? null;
  // A queued job is pending, not in flight. Treating it as running disabled the
  // one control that can drain it and reported "Recompiling…" for a job nothing
  // was working on -- so a queue with no worker looked like perpetual progress.
  const isRunning = recompiling || jobStatus === "running";
  const isFailed = !isRunning && jobStatus === "failed";

  return (
    <div className="wardrobe-compile-status" aria-live="polite">
      <div className="wardrobe-compile-status-text">
        <span>{compilationHeadline(status, isRunning, isFailed)}</span>
        <span className="wardrobe-compile-status-meta">
          Last compiled: {formatLastCompiled(status?.last_compiled_at ?? null)}
        </span>
        {notice ? <span className="wardrobe-compile-status-notice">{notice}</span> : null}
      </div>
      <Button
        aria-label={isFailed ? "Retry compiling your outfit library" : "Recompile outfit library"}
        disabled={isRunning}
        onClick={() => void recompileNow()}
        variant="ghost"
      >
        {isFailed ? "Retry" : "Recompile"}
      </Button>
    </div>
  );
}

function ItemEditFields({
  editValues,
  setEditValues,
}: {
  editValues: ItemEditValues;
  setEditValues: (updater: (current: ItemEditValues) => ItemEditValues) => void;
}) {
  return (
    <>
      <input
        aria-label="Item name"
        required
        value={editValues.name}
        onChange={(event) => setEditValues((value) => ({ ...value, name: event.target.value }))}
      />
      <input
        aria-label="Brand"
        placeholder="Brand (optional)"
        value={editValues.brand}
        onChange={(event) => setEditValues((value) => ({ ...value, brand: event.target.value }))}
      />
      <input
        aria-label="Category"
        required
        value={editValues.category}
        onChange={(event) => setEditValues((value) => ({ ...value, category: event.target.value }))}
      />
      <textarea
        aria-label="Notes"
        value={editValues.notes}
        onChange={(event) => setEditValues((value) => ({ ...value, notes: event.target.value }))}
      />
    </>
  );
}

export function ItemEditForm({
  item,
  setItem,
  editValues,
  setEditValues,
  busy,
  action,
  onSaved,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  editValues: ItemEditValues;
  setEditValues: (updater: (current: ItemEditValues) => ItemEditValues) => void;
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onSaved: () => void;
}) {
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action("edit", async () => {
      const saved = await requestJson<WardrobeItem>(`/api/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editValues.name,
          brand: editValues.brand || null,
          category: editValues.category,
          notes: editValues.notes,
        }),
      });
      setItem((current) => (current ? { ...current, ...saved } : current));
      onSaved();
    });
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <ItemEditFields editValues={editValues} setEditValues={setEditValues} />
      <Button disabled={busy === "edit"} type="submit">
        Save details
      </Button>
    </form>
  );
}

function ItemAvailabilitySelect({
  item,
  setItem,
  action,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
}) {
  return (
    <select
      aria-label="Availability"
      value={item.availability_status}
      onChange={(event) =>
        void action("availability", async () => {
          const result = await requestJson<{ availability_status: AvailabilityStatus }>(
            `/api/items/${item.id}/availability`,
            { method: "POST", body: JSON.stringify({ availability_status: event.target.value }) },
          );
          setItem((current) =>
            current ? { ...current, availability_status: result.availability_status } : current,
          );
        })
      }
    >
      {Object.entries(AVAILABILITY_LABELS).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

export function ItemFactsList({
  item,
  setItem,
  action,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
}) {
  return (
    <dl className="item-facts">
      <div>
        <dt>Colors</dt>
        <dd>{item.color_names.join(" · ") || "Not recorded"}</dd>
      </div>
      <div>
        <dt>Material</dt>
        <dd>
          {Object.keys(item.materials).length ? JSON.stringify(item.materials) : "Not recorded"}
        </dd>
      </div>
      <div>
        <dt>Fit</dt>
        <dd>{item.fit ?? "Not recorded"}</dd>
      </div>
      <div>
        <dt>Formality</dt>
        <dd>{item.formality_level ? `${item.formality_level} / 5` : "Not recorded"}</dd>
      </div>
      <div>
        <dt>Season</dt>
        <dd>{item.season_tags.join(" · ") || "Not recorded"}</dd>
      </div>
      <div>
        <dt>Availability</dt>
        <dd>
          <ItemAvailabilitySelect action={action} item={item} setItem={setItem} />
        </dd>
      </div>
    </dl>
  );
}

function ItemHeading({
  item,
  setItem,
  action,
}: {
  item: ItemDetail;
  setItem: (updater: (current: ItemDetail | null) => ItemDetail | null) => void;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
}) {
  return (
    <div className="item-detail__heading">
      <div>
        <p className="eyebrow">{item.category}</p>
        <h1>{item.name}</h1>
        <p>{item.brand ?? "Brand not confirmed"}</p>
      </div>
      <button
        aria-label={item.favorite ? "Remove from favorites" : "Add to favorites"}
        aria-pressed={item.favorite}
        className="favorite-button"
        onClick={() =>
          void action("favorite", async () => {
            const result = await requestJson<{ favorite: boolean }>(
              `/api/items/${item.id}/favorite`,
              {
                method: "POST",
                body: JSON.stringify({ favorite: !item.favorite }),
              },
            );
            setItem((current) => (current ? { ...current, favorite: result.favorite } : current));
          })
        }
        type="button"
      >
        <Heart size={21} weight={item.favorite ? "fill" : "regular"} />
      </button>
    </div>
  );
}

function ItemDetailActionBar({ onToggleEdit }: { onToggleEdit: () => void }) {
  return (
    <div className="item-detail__actions">
      <Button onClick={onToggleEdit}>
        <PencilSimple size={16} /> Edit details
      </Button>
      <Button
        onClick={() =>
          document.getElementById("item-research")?.scrollIntoView({ behavior: "smooth" })
        }
        variant="secondary"
      >
        <MagicWand size={16} /> Research item
      </Button>
    </div>
  );
}

export function ItemDetailContent({
  item,
  state,
}: {
  item: ItemDetail;
  state: ReturnType<typeof useItemDetail>;
}) {
  return (
    <section className="item-detail__content">
      <ItemHeading action={state.action} item={item} setItem={state.setItem} />
      <ItemDetailActionBar onToggleEdit={() => state.setEditing((value) => !value)} />
      {state.editing ? (
        <ItemEditForm
          action={state.action}
          busy={state.busy}
          editValues={state.editValues}
          item={item}
          onSaved={() => state.setEditing(false)}
          setEditValues={state.setEditValues}
          setItem={state.setItem}
        />
      ) : null}
      <ItemFactsList action={state.action} item={item} setItem={state.setItem} />
    </section>
  );
}

function ItemFormColorFields({
  primaryColorHex,
  onPrimaryColorHex,
  colorNames,
  onColorNames,
}: {
  primaryColorHex: string;
  onPrimaryColorHex: (value: string) => void;
  colorNames: string;
  onColorNames: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <ItemFormPrimaryColorField
        onPrimaryColorHex={onPrimaryColorHex}
        primaryColorHex={primaryColorHex}
      />
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-color-names">Color names</label>
          <span>Comma separated</span>
        </div>
        <input
          className="text-input"
          id="item-color-names"
          onChange={(event) => onColorNames(event.target.value)}
          placeholder="navy, cream"
          value={colorNames}
        />
      </div>
    </div>
  );
}

function ItemFormPrimaryColorField({
  primaryColorHex,
  onPrimaryColorHex,
}: {
  primaryColorHex: string;
  onPrimaryColorHex: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="item-color">Primary color</label>
      </div>
      <div className="optional-color-row">
        <input
          aria-label="Choose primary color"
          id="item-color"
          disabled={!primaryColorHex}
          onChange={(event) => onPrimaryColorHex(event.target.value)}
          type="color"
          value={primaryColorHex || "#8b7d6b"}
        />
        <label className="check-row">
          <input
            checked={Boolean(primaryColorHex)}
            onChange={(event) => onPrimaryColorHex(event.target.checked ? "#8b7d6b" : "")}
            type="checkbox"
          />
          Include
        </label>
      </div>
    </div>
  );
}

function ItemFormCategoryBrandFields({
  category,
  onCategory,
  brand,
  onBrand,
}: {
  category: string;
  onCategory: (value: string) => void;
  brand: string;
  onBrand: (value: string) => void;
}) {
  return (
    <div className="form-grid form-grid--two">
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="item-category">Category</label>
        </div>
        <select
          className="select-input"
          id="item-category"
          onChange={(event) => onCategory(event.target.value)}
          value={category}
        >
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {titleCase(option)}
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
          onChange={(event) => onBrand(event.target.value)}
          value={brand}
        />
      </div>
    </div>
  );
}

function ItemFormNameImageFields({
  name,
  onName,
  onImage,
}: {
  name: string;
  onName: (value: string) => void;
  onImage: (file: File | null) => void;
}) {
  return (
    <>
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
          onChange={(event) => onName(event.target.value)}
          required
          value={name}
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
          onChange={(event) => onImage(event.target.files?.[0] ?? null)}
          type="file"
        />
      </div>
    </>
  );
}

function ItemFormNotesField({
  notes,
  onNotes,
}: {
  notes: string;
  onNotes: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="item-notes">Notes</label>
        <span>Optional</span>
      </div>
      <textarea
        className="textarea-input"
        id="item-notes"
        maxLength={2000}
        onChange={(event) => onNotes(event.target.value)}
        placeholder="Fit, care, styling, or purchase notes"
        value={notes}
      />
    </div>
  );
}

export function ItemFormFields({
  values,
  setField,
  onImage,
}: {
  values: ItemFormValues;
  setField: <Key extends keyof ItemFormValues>(key: Key, value: ItemFormValues[Key]) => void;
  onImage: (file: File | null) => void;
}) {
  return (
    <>
      <ItemFormNameImageFields
        name={values.name}
        onName={(value) => setField("name", value)}
        onImage={onImage}
      />
      <ItemFormCategoryBrandFields
        category={values.category}
        onCategory={(value) => setField("category", value)}
        brand={values.brand}
        onBrand={(value) => setField("brand", value)}
      />
      <ItemFormColorFields
        primaryColorHex={values.primaryColorHex}
        onPrimaryColorHex={(value) => setField("primaryColorHex", value)}
        colorNames={values.colorNames}
        onColorNames={(value) => setField("colorNames", value)}
      />
      <ItemFormNotesField notes={values.notes} onNotes={(value) => setField("notes", value)} />
    </>
  );
}

function ItemFormFooter({
  error,
  saving,
  editing,
  canSubmit,
  onClose,
}: {
  error: string | null;
  saving: boolean;
  editing: boolean;
  canSubmit: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
      <div className="item-form-dialog__actions">
        <Button onClick={onClose} type="button" variant="ghost">
          Cancel
        </Button>
        <Button disabled={saving || !canSubmit} type="submit">
          {saving ? <SpinnerGap className="spin" size={16} /> : null}
          {editing ? "Save changes" : "Add to wardrobe"}
        </Button>
      </div>
    </>
  );
}

function ItemFormDialogHeader({ editing, onClose }: { editing: boolean; onClose: () => void }) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">{editing ? "Edit piece" : "Manual entry"}</p>
        <h2 id="item-form-title">{editing ? "Update garment" : "Add a garment"}</h2>
      </div>
      <button aria-label="Close" className="icon-button" onClick={onClose} type="button">
        <X size={18} />
      </button>
    </div>
  );
}

export function ItemFormDialog({
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
  const { values, setField, saving, error, setImage, editing, submit } = useItemForm(
    item,
    onSaved,
    onWarning,
  );

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="item-form-title"
        aria-modal="true"
        className="item-form-dialog"
        role="dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ItemFormDialogHeader editing={editing} onClose={onClose} />
        <form className="form-grid" onSubmit={submit}>
          <ItemFormFields onImage={setImage} setField={setField} values={values} />
          <ItemFormFooter
            canSubmit={Boolean(values.name.trim())}
            editing={editing}
            error={error}
            onClose={onClose}
            saving={saving}
          />
        </form>
      </section>
    </div>
  );
}

export function WardrobeCardControls({
  itemName,
  availability,
  busy,
  onEdit,
  onAvailability,
  onDelete,
}: {
  itemName: string;
  availability: AvailabilityStatus;
  busy: boolean;
  onEdit: () => void;
  onAvailability: (availability: AvailabilityStatus) => void;
  onDelete: () => void;
}) {
  return (
    <div className="wardrobe-card__controls">
      <label>
        <span className="sr-only">Availability for {itemName}</span>
        <select
          aria-label={`Availability for ${itemName}`}
          disabled={busy}
          onChange={(event) => onAvailability(event.target.value as AvailabilityStatus)}
          value={availability}
        >
          {AVAILABILITY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button aria-label={`Edit ${itemName}`} disabled={busy} onClick={onEdit} type="button">
        <PencilSimple size={14} /> Edit
      </button>
      <button
        aria-label={`Delete ${itemName}`}
        className="danger-link"
        disabled={busy}
        onClick={onDelete}
        type="button"
      >
        <Trash size={14} />
      </button>
    </div>
  );
}

function WardrobeCardMedia({
  item,
  busy,
  onFavorite,
}: {
  item: LiveWardrobeItem;
  busy: boolean;
  onFavorite: () => void;
}) {
  return (
    <>
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
    </>
  );
}

export function LiveWardrobeCard({
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
      <WardrobeCardMedia busy={busy} item={item} onFavorite={onFavorite} />
      <div className="wardrobe-card__body">
        <div>
          <p>{titleCase(item.category)}</p>
          <h3>
            <Link href={`/wardrobe/${item.id}`}>{item.name}</Link>
          </h3>
        </div>
        <span className="wardrobe-card__meta">{meta || "No brand or color details yet"}</span>
        <WardrobeCardControls
          availability={item.availability_status}
          busy={busy}
          itemName={item.name}
          onAvailability={onAvailability}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      </div>
    </article>
  );
}

export function ResearchDecisionActions({
  itemId,
  run,
  researchFields,
  busy,
  action,
  onDecided,
}: {
  itemId: string;
  run: ResearchRun;
  researchFields: string[];
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDecided: () => Promise<void>;
}) {
  if (!["verified", "likely", "uncertain"].includes(run.status)) return null;
  return (
    <div className="item-detail__actions">
      <Button
        disabled={!researchFields.length || busy === "accept-research"}
        onClick={() =>
          void action("accept-research", async () => {
            await requestJson(`/api/items/${itemId}/research/${run.id}/accept`, {
              method: "POST",
              body: JSON.stringify({ fields: researchFields }),
            });
            await onDecided();
          })
        }
      >
        <Check size={15} /> Accept supported fields
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          void action("reject-research", async () => {
            await requestJson(`/api/items/${itemId}/research/${run.id}/reject`, { method: "POST" });
            await onDecided();
          })
        }
      >
        Reject proposal
      </Button>
    </div>
  );
}

function ResearchClueForm({
  itemId,
  researchClue,
  setResearchClue,
  busy,
  action,
  reload,
}: {
  itemId: string;
  researchClue: string;
  setResearchClue: (value: string) => void;
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  return (
    <>
      <label className="form-field">
        <span>Optional clue</span>
        <input
          value={researchClue}
          onChange={(event) => setResearchClue(event.target.value)}
          placeholder="Label text, SKU, model, or product clue"
        />
      </label>
      <Button
        disabled={busy === "research"}
        onClick={() => void action("research", () => startResearch(itemId, researchClue, reload))}
        variant="secondary"
      >
        {busy === "research" ? <SpinnerGap className="spin" size={16} /> : <MagicWand size={16} />}{" "}
        Start source-backed research
      </Button>
    </>
  );
}

export function ResearchCard({
  itemId,
  latestResearch,
  researchFields,
  researchClue,
  setResearchClue,
  busy,
  action,
  reload,
}: ResearchCardProps) {
  return (
    <Card as="section" className="research-card" id="item-research">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Product research</p>
          <h2>{latestResearch?.summary || "Identity not researched"}</h2>
        </div>
        <Badge tone={latestResearch?.status === "verified" ? "sage" : "neutral"}>
          {latestResearch?.status ?? "Not started"}
        </Badge>
      </div>
      <p>
        Research uses confirmed labels, SKU/barcode, brand clues, and source evidence. Similar
        appearance alone is never proof.
      </p>
      <ResearchClueForm
        action={action}
        busy={busy}
        itemId={itemId}
        reload={reload}
        researchClue={researchClue}
        setResearchClue={setResearchClue}
      />
      {latestResearch?.research_sources.length ? (
        <ul className="research-source-list">
          {latestResearch.research_sources.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title || source.domain}
              </a>{" "}
              <small>{source.source_type}</small>
            </li>
          ))}
        </ul>
      ) : null}
      {latestResearch ? (
        <ResearchDecisionActions
          action={action}
          busy={busy}
          itemId={itemId}
          onDecided={reload}
          researchFields={researchFields}
          run={latestResearch}
        />
      ) : null}
    </Card>
  );
}

function WardrobeActiveFilters({
  availability,
  favoritesOnly,
  onClearAvailability,
  onClearFavorites,
  onClearAll,
}: {
  availability: AvailabilityStatus | "";
  favoritesOnly: boolean;
  onClearAvailability: () => void;
  onClearFavorites: () => void;
  onClearAll: () => void;
}) {
  return (
    <div className="active-filters">
      {availability ? (
        <span>
          {AVAILABILITY_OPTIONS.find((option) => option.value === availability)?.label}
          <button
            aria-label="Remove availability filter"
            onClick={onClearAvailability}
            type="button"
          >
            ×
          </button>
        </span>
      ) : null}
      {favoritesOnly ? (
        <span>
          Favorites
          <button aria-label="Remove favorites filter" onClick={onClearFavorites} type="button">
            ×
          </button>
        </span>
      ) : null}
      <button onClick={onClearAll} type="button">
        Clear all
      </button>
    </div>
  );
}

function WardrobeCategoryTabs({
  category,
  onCategory,
  total,
  hasQuery,
}: {
  category: string;
  onCategory: (value: string) => void;
  total: number;
  hasQuery: boolean;
}) {
  return (
    <div className="category-tabs" role="tablist" aria-label="Wardrobe categories">
      {categoryFilters.map((filter) => (
        <button
          className={category === filter.value ? "is-active" : ""}
          key={filter.value || "all"}
          role="tab"
          aria-selected={category === filter.value}
          onClick={() => onCategory(filter.value)}
          type="button"
        >
          {filter.label}
          {!filter.value && !hasQuery ? <span>{total}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function WardrobeCategorySection({
  filters,
  setFilter,
  clearAllFilters,
  total,
}: {
  filters: WardrobeFilters;
  setFilter: <Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) => void;
  clearAllFilters: () => void;
  total: number;
}) {
  const hasQuery = hasActiveQuery(filters);
  return (
    <>
      <WardrobeCategoryTabs
        category={filters.category}
        hasQuery={hasQuery}
        onCategory={(value) => setFilter("category", value)}
        total={total}
      />
      {hasQuery ? (
        <WardrobeActiveFilters
          availability={filters.availability}
          favoritesOnly={filters.favoritesOnly}
          onClearAll={clearAllFilters}
          onClearAvailability={() => setFilter("availability", "")}
          onClearFavorites={() => setFilter("favoritesOnly", false)}
        />
      ) : null}
    </>
  );
}

function FilterSelectField({
  label,
  placeholder,
  value,
  onChange,
  options,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <select
        className="select-input"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function WardrobeFilterSelects({
  season,
  onSeason,
  occasion,
  onOccasion,
  formality,
  onFormality,
}: {
  season: string;
  onSeason: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
  formality: string;
  onFormality: (value: string) => void;
}) {
  return (
    <>
      <FilterSelectField
        label="Season"
        onChange={onSeason}
        options={SEASON_OPTIONS}
        placeholder="Any season"
        value={season}
      />
      <FilterSelectField
        label="Occasion"
        onChange={onOccasion}
        options={OCCASION_OPTIONS}
        placeholder="Any occasion"
        value={occasion}
      />
      <FilterSelectField
        label="Formality"
        onChange={onFormality}
        options={FORMALITY_OPTIONS}
        placeholder="Any level"
        value={formality}
      />
    </>
  );
}

function WardrobeFilterAvailabilityStatus({
  availability,
  onAvailability,
  itemStatus,
  onItemStatus,
}: {
  availability: AvailabilityStatus | "";
  onAvailability: (value: AvailabilityStatus | "") => void;
  itemStatus: WardrobeItemStatus | "";
  onItemStatus: (value: WardrobeItemStatus | "") => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Availability</span>
        <select
          className="select-input"
          onChange={(event) => onAvailability(event.target.value as AvailabilityStatus | "")}
          value={availability}
        >
          <option value="">Any availability</option>
          {AVAILABILITY_OPTIONS.map((option) => (
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
          onChange={(event) => onItemStatus(event.target.value as WardrobeItemStatus | "")}
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
    </>
  );
}

function WardrobeFilterTextInputs({
  brand,
  onBrand,
  color,
  onColor,
}: {
  brand: string;
  onBrand: (value: string) => void;
  color: string;
  onColor: (value: string) => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Brand</span>
        <input
          className="text-input"
          onChange={(event) => onBrand(event.target.value)}
          placeholder="Any brand"
          type="search"
          value={brand}
        />
      </label>
      <label className="form-field">
        <span>Color name</span>
        <input
          className="text-input"
          onChange={(event) => onColor(event.target.value)}
          placeholder="navy"
          type="search"
          value={color}
        />
      </label>
    </>
  );
}

export function WardrobeFilterPanel({
  filters,
  setFilter,
  onClearAdvanced,
}: {
  filters: WardrobeFilters;
  setFilter: <Key extends keyof WardrobeFilters>(key: Key, value: WardrobeFilters[Key]) => void;
  onClearAdvanced: () => void;
}) {
  return (
    <div className="wardrobe-filter-panel">
      <WardrobeFilterAvailabilityStatus
        availability={filters.availability}
        itemStatus={filters.itemStatus}
        onAvailability={(value) => setFilter("availability", value)}
        onItemStatus={(value) => setFilter("itemStatus", value)}
      />
      <WardrobeFilterTextInputs
        brand={filters.brand}
        color={filters.color}
        onBrand={(value) => setFilter("brand", value)}
        onColor={(value) => setFilter("color", value)}
      />
      <WardrobeFilterSelects
        formality={filters.formality}
        occasion={filters.occasion}
        onFormality={(value) => setFilter("formality", value)}
        onOccasion={(value) => setFilter("occasion", value)}
        onSeason={(value) => setFilter("season", value)}
        season={filters.season}
      />
      <label className="check-row wardrobe-filter-panel__check">
        <input
          checked={filters.favoritesOnly}
          onChange={(event) => setFilter("favoritesOnly", event.target.checked)}
          type="checkbox"
        />
        Favorites only
      </label>
      <Button onClick={onClearAdvanced} variant="ghost">
        Clear filters
      </Button>
    </div>
  );
}

export function WardrobeItemDetail({ itemId }: { itemId: string }) {
  const router = useRouter();
  const state = useItemDetail(itemId);

  if (state.loading) {
    return (
      <div className="page-stack" aria-busy="true">
        <Link className="back-link" href="/wardrobe">
          <ArrowLeft size={15} /> Back to wardrobe
        </Link>
        <Card>
          <SpinnerGap className="spin" size={20} /> Loading private item…
        </Card>
      </div>
    );
  }
  if (!state.item) {
    return (
      <div className="page-stack">
        <Link className="back-link" href="/wardrobe">
          <ArrowLeft size={15} /> Back to wardrobe
        </Link>
        <Card>
          <WarningCircle size={20} />
          <h1>Item unavailable</h1>
          <p>{state.error ?? "This item was not found in your wardrobe."}</p>
          <Button onClick={() => void state.load()} variant="secondary">
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="item-page">
      <Link className="back-link" href="/wardrobe">
        <ArrowLeft size={15} /> Back to wardrobe
      </Link>
      {state.error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {state.error}
        </div>
      ) : null}
      <div className="item-detail">
        <ItemVisualSection item={state.item} />
        <ItemDetailContent item={state.item} state={state} />
      </div>
      <ItemDetailLowerGrid item={state.item} state={state} />
      <ItemDangerZone
        action={state.action}
        itemId={state.item.id}
        itemName={state.item.name}
        onDone={() => router.push("/wardrobe")}
      />
    </div>
  );
}

function WearHistoryCard({
  item,
  costPerWear,
  busy,
  action,
  reload,
}: {
  item: ItemDetail;
  costPerWear: string | null;
  busy: string | null;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  reload: () => Promise<void>;
}) {
  return (
    <Card as="section" className="wear-card">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Wear history</p>
          <h2>{item.wear_count} wears</h2>
        </div>
        {costPerWear ? <Badge tone="sage">{costPerWear} / wear</Badge> : null}
      </div>
      <p>
        {item.last_worn_at
          ? `Last worn ${new Date(item.last_worn_at).toLocaleDateString()}`
          : "No wear logged yet"}
      </p>
      <Button
        disabled={busy === "wear"}
        onClick={() =>
          void action("wear", async () => {
            await requestJson(`/api/items/${item.id}/mark-worn`, { method: "POST", body: "{}" });
            await reload();
          })
        }
      >
        <Check size={16} /> Mark worn today
      </Button>
    </Card>
  );
}

function ItemDetailLowerGrid({
  item,
  state,
}: {
  item: ItemDetail;
  state: ReturnType<typeof useItemDetail>;
}) {
  return (
    <div className="item-lower-grid">
      <ResearchCard
        action={state.action}
        busy={state.busy}
        itemId={item.id}
        latestResearch={state.latestResearch}
        reload={state.load}
        researchClue={state.researchClue}
        researchFields={state.researchFields}
        setResearchClue={state.setResearchClue}
      />
      <WearHistoryCard
        action={state.action}
        busy={state.busy}
        costPerWear={state.costPerWear}
        item={item}
        reload={state.load}
      />
    </div>
  );
}

function ItemDeleteButton({
  itemId,
  itemName,
  action,
  onDone,
}: {
  itemId: string;
  itemName: string;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDone: () => void;
}) {
  return (
    <Button
      variant="danger"
      onClick={() => {
        if (!window.confirm(`Permanently delete ${itemName} and its images?`)) return;
        void action("delete", async () => {
          await requestJson(`/api/items/${itemId}`, { method: "DELETE" });
          onDone();
        });
      }}
    >
      <Trash size={15} /> Delete piece
    </Button>
  );
}

function ItemArchiveButton({
  itemId,
  action,
  onDone,
}: {
  itemId: string;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDone: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onClick={() =>
        void action("archive", async () => {
          await requestJson(`/api/items/${itemId}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "archived" }),
          });
          onDone();
        })
      }
    >
      Archive
    </Button>
  );
}

function ItemVisualSection({ item }: { item: ItemDetail }) {
  return (
    <section className="item-detail__visual" aria-label={`${item.name} private images`}>
      <div className="item-detail__art">
        {item.primary_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={item.name} src={item.primary_image_url} />
        ) : (
          <div className="item-detail__image-empty">No image yet</div>
        )}
        <Badge tone="outline">Private image</Badge>
      </div>
      {item.images.length > 1 ? (
        <div className="item-detail__thumbs">
          {item.images.map((image) => (
            <a href={image.signed_url} key={image.id} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`${item.name} ${image.kind}`} src={image.signed_url} />
              <span>{image.kind}</span>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ItemDangerZone({
  itemId,
  itemName,
  action,
  onDone,
}: {
  itemId: string;
  itemName: string;
  action: (name: string, operation: () => Promise<void>) => Promise<void>;
  onDone: () => void;
}) {
  return (
    <div className="item-danger">
      <div>
        <h2>Archive or delete</h2>
        <p>Archived pieces remain in history but are excluded from recommendations.</p>
      </div>
      <div>
        <ItemArchiveButton action={action} itemId={itemId} onDone={onDone} />
        <ItemDeleteButton action={action} itemId={itemId} itemName={itemName} onDone={onDone} />
      </div>
    </div>
  );
}

function WardrobeLiveGrid({
  items,
  listView,
  busyItemId,
  onEdit,
  onFavorite,
  onAvailability,
  onDelete,
}: {
  items: LiveWardrobeItem[];
  listView: boolean;
  busyItemId: string | null;
  onEdit: (item: LiveWardrobeItem) => void;
  onFavorite: (item: LiveWardrobeItem) => void;
  onAvailability: (item: LiveWardrobeItem, next: LiveWardrobeItem["availability_status"]) => void;
  onDelete: (item: LiveWardrobeItem) => void;
}) {
  return (
    <section
      aria-label="Wardrobe items"
      className={`wardrobe-grid${listView ? " wardrobe-grid--list" : ""}`}
    >
      {items.map((item) => (
        <LiveWardrobeCard
          busy={busyItemId === item.id}
          item={item}
          key={item.id}
          onAvailability={(next) => onAvailability(item, next)}
          onDelete={() => onDelete(item)}
          onEdit={() => onEdit(item)}
          onFavorite={() => onFavorite(item)}
        />
      ))}
    </section>
  );
}

function WardrobeEmptyState({
  hasQuery,
  onClearAllFilters,
  onAddManually,
}: {
  hasQuery: boolean;
  onClearAllFilters: () => void;
  onAddManually: () => void;
}) {
  return (
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
          <Button onClick={onClearAllFilters} variant="secondary">
            Clear filters
          </Button>
        ) : (
          <Button onClick={onAddManually}>
            <Plus size={16} /> Add first piece
          </Button>
        )}
      </div>
    </section>
  );
}

export function WardrobeResultsSection({
  loading,
  items,
  listView,
  hasQuery,
  busyItemId,
  onEdit,
  onFavorite,
  onAvailability,
  onDelete,
  onClearAllFilters,
  onAddManually,
}: WardrobeResultsSectionProps) {
  if (loading) {
    return (
      <section
        aria-busy="true"
        aria-label="Loading wardrobe"
        className={`wardrobe-grid${listView ? " wardrobe-grid--list" : ""}`}
      >
        {Array.from({ length: 8 }, (_, index) => (
          <div className="wardrobe-card wardrobe-card--skeleton" key={index}>
            <span />
            <i />
            <i />
          </div>
        ))}
      </section>
    );
  }
  if (!items.length) {
    return (
      <WardrobeEmptyState
        hasQuery={hasQuery}
        onAddManually={onAddManually}
        onClearAllFilters={onClearAllFilters}
      />
    );
  }
  return (
    <WardrobeLiveGrid
      busyItemId={busyItemId}
      items={items}
      listView={listView}
      onAvailability={onAvailability}
      onDelete={onDelete}
      onEdit={onEdit}
      onFavorite={onFavorite}
    />
  );
}

function WardrobeResultsHeader({
  configured,
  loading,
  total,
  sort,
  onSort,
}: {
  configured: boolean;
  loading: boolean;
  total: number;
  sort: string;
  onSort: (value: string) => void;
}) {
  return (
    <div className="wardrobe-results">
      <p>{loading ? "Loading wardrobe…" : `${total} ${total === 1 ? "piece" : "pieces"}`}</p>
      <CompilationStatus configured={configured} />
      <select
        aria-label="Sort wardrobe"
        onChange={(event) => onSort(event.target.value)}
        value={sort}
      >
        <option value="recent">Recently added</option>
        <option value="worn">Most worn</option>
        <option value="name">Name A–Z</option>
      </select>
    </div>
  );
}

export function WardrobeManagerResults({
  state,
}: {
  state: ReturnType<typeof useWardrobeManagerState>;
}) {
  return (
    <>
      <WardrobeResultsHeader
        configured
        loading={state.loading}
        onSort={state.setSort}
        sort={state.sort}
        total={state.total}
      />
      {state.error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} />
          <span>{state.error}</span>
          <Button onClick={() => state.setRetry((value) => value + 1)} variant="ghost">
            Try again
          </Button>
        </div>
      ) : null}
      <WardrobeResultsSection
        busyItemId={state.actions.busyItemId}
        hasQuery={hasActiveQuery(state.filters)}
        items={state.sortedItems}
        listView={state.viewMode === "list"}
        loading={state.loading}
        onAddManually={() => state.openForm(null)}
        onAvailability={(item, next) => state.actions.setAvailability(item.id, next)}
        onClearAllFilters={state.clearAllFilters}
        onDelete={state.actions.deleteItem}
        onEdit={state.openForm}
        onFavorite={state.actions.toggleFavorite}
      />
    </>
  );
}

function WardrobeViewSwitch({
  viewMode,
  onChange,
  disabled = false,
}: {
  viewMode: "grid" | "list";
  onChange: (mode: "grid" | "list") => void;
  disabled?: boolean;
}) {
  return (
    <div className="view-switch" aria-label="Wardrobe view">
      <button
        aria-label="Grid view"
        aria-pressed={viewMode === "grid"}
        className={viewMode === "grid" ? "is-active" : ""}
        onClick={() => onChange("grid")}
        type="button"
      >
        <GridFour size={17} />
      </button>
      <button
        aria-label={disabled ? "List view" : "Compact list view"}
        aria-pressed={viewMode === "list"}
        className={viewMode === "list" ? "is-active" : ""}
        disabled={disabled}
        onClick={() => onChange("list")}
        type="button"
      >
        <Rows size={17} />
      </button>
    </div>
  );
}

export function WardrobeToolbar({
  search,
  onSearch,
  viewMode,
  onViewMode,
  filtersOpen,
  onToggleFilters,
  activeFilterCount,
  disabled = false,
}: {
  search: string;
  onSearch: (value: string) => void;
  viewMode: "grid" | "list";
  onViewMode: (mode: "grid" | "list") => void;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  disabled?: boolean;
}) {
  return (
    <div className="wardrobe-toolbar">
      <label className="search-field">
        <MagnifyingGlass size={18} aria-hidden="true" />
        <span className="sr-only">Search wardrobe</span>
        <input
          disabled={disabled}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by garment name"
          type="search"
          value={search}
        />
      </label>
      <Button
        aria-expanded={filtersOpen}
        disabled={disabled}
        onClick={onToggleFilters}
        variant="secondary"
      >
        <FunnelSimple size={17} /> Filters
        {activeFilterCount ? <span className="filter-count">{activeFilterCount}</span> : null}
      </Button>
      <WardrobeViewSwitch disabled={disabled} onChange={onViewMode} viewMode={viewMode} />
    </div>
  );
}

function WardrobeItemCard({
  item,
  sample = false,
}: {
  item: GarmentPreviewItem;
  sample?: boolean;
}) {
  return (
    <article className="wardrobe-card">
      <Link
        className="wardrobe-card__image"
        href={`/wardrobe/${item.id}`}
        aria-label={`Open ${item.name}`}
      >
        <GarmentArtwork category={item.category} color={item.color} accent={item.accent} />
        {sample ? <Badge tone="outline">Sample</Badge> : null}
        {item.favorite ? (
          <Heart
            className="wardrobe-card__favorite"
            weight="fill"
            size={18}
            aria-label="Favorite"
          />
        ) : null}
      </Link>
      <div className="wardrobe-card__body">
        <div>
          <p>{item.categoryLabel}</p>
          <h3>
            <Link href={`/wardrobe/${item.id}`}>{item.name}</Link>
          </h3>
        </div>
        <span className="wardrobe-card__meta">{item.meta}</span>
        {item.status === "laundry" ? (
          <span className="wardrobe-card__status">
            <WarningCircle size={14} /> In laundry
          </span>
        ) : null}
      </div>
    </article>
  );
}

function WardrobeHeaderActions({ onAddManually }: { onAddManually?: () => void }) {
  return (
    <>
      <ButtonLink href="/wardrobe/import">
        <UploadSimple size={16} /> Add by photo
      </ButtonLink>
      <Button disabled={!onAddManually} onClick={onAddManually} variant="secondary">
        <Plus size={16} /> Add manually
      </Button>
    </>
  );
}

function PreviewWardrobe({ items }: { items: GarmentPreviewItem[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Search, filter, and understand every piece you own."
        meta={<PreviewBadge />}
        actions={<WardrobeHeaderActions />}
      />
      <DemoNotice>
        These garments are labeled samples because Supabase is not configured. Connect Supabase to
        load and manage your private wardrobe.
      </DemoNotice>
      <WardrobeToolbar
        activeFilterCount={0}
        disabled
        filtersOpen={false}
        onSearch={() => {}}
        onToggleFilters={() => {}}
        onViewMode={() => {}}
        search=""
        viewMode="grid"
      />
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

function WardrobeManagerFilters({
  filters,
  setFilter,
  filtersOpen,
  setFiltersOpen,
  clearAdvancedFilters,
  clearAllFilters,
  viewMode,
  setViewMode,
  total,
}: WardrobeManagerFiltersProps) {
  return (
    <>
      <WardrobeToolbar
        activeFilterCount={activeFilterCount(filters)}
        filtersOpen={filtersOpen}
        onSearch={(value) => setFilter("search", value)}
        onToggleFilters={() => setFiltersOpen((current) => !current)}
        onViewMode={setViewMode}
        search={filters.search}
        viewMode={viewMode}
      />
      {filtersOpen ? (
        <WardrobeFilterPanel
          filters={filters}
          onClearAdvanced={clearAdvancedFilters}
          setFilter={setFilter}
        />
      ) : null}
      <WardrobeCategorySection
        clearAllFilters={clearAllFilters}
        filters={filters}
        setFilter={setFilter}
        total={total}
      />
    </>
  );
}

export function WardrobeManager({
  configured,
  previewItems,
}: {
  configured: boolean;
  previewItems: GarmentPreviewItem[];
}) {
  const state = useWardrobeManagerState(configured);

  if (!configured) return <PreviewWardrobe items={previewItems} />;

  return (
    <>
      <PageHeader
        eyebrow="Your closet"
        title="Wardrobe"
        description="Search, filter, and understand every piece you own."
        actions={<WardrobeHeaderActions onAddManually={() => state.openForm(null)} />}
      />
      <WardrobeManagerFilters
        clearAdvancedFilters={state.clearAdvancedFilters}
        clearAllFilters={state.clearAllFilters}
        filters={state.filters}
        filtersOpen={state.filtersOpen}
        setFilter={state.setFilter}
        setFiltersOpen={state.setFiltersOpen}
        setViewMode={state.setViewMode}
        total={state.total}
        viewMode={state.viewMode}
      />
      <WardrobeManagerResults state={state} />
      {state.formOpen ? (
        <ItemFormDialog
          item={state.editingItem}
          onClose={state.closeForm}
          onSaved={() => {
            state.closeForm();
            state.setRetry((value) => value + 1);
          }}
          onWarning={state.setError}
        />
      ) : null}
    </>
  );
}
