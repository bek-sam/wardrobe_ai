"use client";

import type { FoundationMode, LiveWardrobeItem, OutfitSelections } from "./outfits-model";
import type { WardrobeItemRole } from "@/features/wardrobe";
import { roleLabels } from "./outfits-model";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { roleColors } from "./outfits-model";
import { SpinnerGap } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import { WarningCircle } from "@phosphor-icons/react";
import { useManualOutfitDialog } from "./outfits-model";
import type { OutfitRecord } from "./outfits-model";
import { X } from "@phosphor-icons/react";
import { Plus } from "@phosphor-icons/react";
import { ButtonLink } from "@/components/ui";
import { ArrowRight, Heart } from "@phosphor-icons/react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import type { OutfitPreview } from "./outfits-model";
import { CheckCircle, Trash } from "@phosphor-icons/react";
import type { OutfitFilter } from "./outfits-model";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { Sparkle } from "@phosphor-icons/react";
import type { useOutfitCardActions } from "./outfits-model";
import { PageHeader } from "@/components/ui";
import { useOutfitsManagerState } from "./outfits-model";
import { PreviewBadge } from "@/components/ui";
import { DemoNotice } from "@/components/ui";

function RoleSelectField({
  role,
  required,
  items,
  value,
  onSelect,
  saving,
}: {
  role: WardrobeItemRole;
  required: boolean;
  items: LiveWardrobeItem[];
  value: OutfitSelections[WardrobeItemRole];
  onSelect: (role: WardrobeItemRole, itemId: string) => void;
  saving: boolean;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor={`manual-outfit-${role}`}>{roleLabels[role]}</label>
        <span>{required ? "Required" : "Optional"}</span>
      </div>
      <select
        className="select-input"
        disabled={saving || items.length === 0}
        id={`manual-outfit-${role}`}
        onChange={(event) => onSelect(role, event.target.value)}
        required={required}
        value={value}
      >
        <option value="">
          {items.length
            ? `Select ${required ? "a" : "an optional"} ${roleLabels[role].toLowerCase()}`
            : `No available ${roleLabels[role].toLowerCase()}`}
        </option>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
            {item.color_names[0] ? ` · ${item.color_names[0]}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

export function RoleSelectGrid({
  activeRoles,
  foundation,
  itemsByRole,
  selections,
  onSelect,
  saving,
}: {
  activeRoles: WardrobeItemRole[];
  foundation: FoundationMode;
  itemsByRole: Record<WardrobeItemRole, LiveWardrobeItem[]>;
  selections: OutfitSelections;
  onSelect: (role: WardrobeItemRole, itemId: string) => void;
  saving: boolean;
}) {
  return (
    <div className="outfit-builder-role-grid">
      {activeRoles.map((role) => (
        <RoleSelectField
          items={itemsByRole[role]}
          key={role}
          onSelect={onSelect}
          required={
            role === "dress" ||
            (foundation === "separates" && (role === "top" || role === "bottom"))
          }
          role={role}
          saving={saving}
          value={selections[role]}
        />
      ))}
    </div>
  );
}

function FoundationPicker({
  foundation,
  onChoose,
  saving,
}: {
  foundation: FoundationMode;
  onChoose: (mode: FoundationMode) => void;
  saving: boolean;
}) {
  return (
    <fieldset className="settings-fieldset" disabled={saving}>
      <legend>Choose a foundation</legend>
      <div className="choice-grid">
        <label className="choice-chip">
          <input
            checked={foundation === "separates"}
            name="outfit-foundation"
            onChange={() => onChoose("separates")}
            type="radio"
          />
          <span>Top + bottom</span>
        </label>
        <label className="choice-chip">
          <input
            checked={foundation === "dress"}
            name="outfit-foundation"
            onChange={() => onChoose("dress")}
            type="radio"
          />
          <span>Dress</span>
        </label>
      </div>
    </fieldset>
  );
}

function SelectedPiecesPreview({
  selectedEntries,
}: {
  selectedEntries: Array<{ role: WardrobeItemRole; item: LiveWardrobeItem }>;
}) {
  if (!selectedEntries.length) return null;
  return (
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
  );
}

export function ManualOutfitFoundationSection({
  state,
}: {
  state: ReturnType<typeof useManualOutfitDialog>;
}) {
  const { wardrobe, selections, form } = state;
  return (
    <>
      <FoundationPicker
        foundation={selections.foundation}
        onChoose={selections.chooseFoundation}
        saving={form.saving}
      />
      <RoleSelectGrid
        activeRoles={selections.activeRoles}
        foundation={selections.foundation}
        itemsByRole={wardrobe.itemsByRole}
        onSelect={(role, itemId) =>
          selections.setSelections((current) => ({ ...current, [role]: itemId }))
        }
        saving={form.saving}
        selections={selections.selections}
      />
      <SelectedPiecesPreview selectedEntries={selections.selectedEntries} />
    </>
  );
}

function ManualOutfitNameOccasionFields({
  name,
  onName,
  occasion,
  onOccasion,
  saving,
}: {
  name: string;
  onName: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
  saving: boolean;
}) {
  return (
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
          onChange={(event) => onName(event.target.value)}
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
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="Work, dinner, travel…"
          value={occasion}
        />
      </div>
    </div>
  );
}

function ManualOutfitNotesField({
  explanation,
  onExplanation,
  favorite,
  onFavorite,
  saving,
}: {
  explanation: string;
  onExplanation: (value: string) => void;
  favorite: boolean;
  onFavorite: (value: boolean) => void;
  saving: boolean;
}) {
  return (
    <>
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
          onChange={(event) => onExplanation(event.target.value)}
          placeholder="Why this combination works, styling notes, or a dress-code reminder"
          rows={3}
          value={explanation}
        />
      </div>
      <label className="check-row">
        <input
          checked={favorite}
          disabled={saving}
          onChange={(event) => onFavorite(event.target.checked)}
          type="checkbox"
        />
        Save as a favorite outfit
      </label>
    </>
  );
}

function ManualOutfitNotes({
  availableCount,
  itemsCount,
  unresolvedCount,
  validationMessage,
  error,
}: {
  availableCount: number;
  itemsCount: number;
  unresolvedCount: number;
  validationMessage: string | null;
  error: string | null;
}) {
  return (
    <>
      {availableCount > itemsCount ? (
        <p className="outfit-builder-note">
          Showing the first {itemsCount} of {availableCount} available pieces.
        </p>
      ) : null}
      {unresolvedCount ? (
        <p className="outfit-builder-note">
          {unresolvedCount} {unresolvedCount === 1 ? "piece has" : "pieces have"} no outfit role yet
          and cannot be selected here. Add a layer role in Wardrobe to use it.
        </p>
      ) : null}
      {validationMessage ? <p className="outfit-builder-note">{validationMessage}</p> : null}
      {error ? (
        <p className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={16} /> {error}
        </p>
      ) : null}
    </>
  );
}

function ManualOutfitFooter({
  saving,
  validationMessage,
  onCancel,
}: {
  saving: boolean;
  validationMessage: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="item-form-dialog__actions">
      <Button disabled={saving} onClick={onCancel} type="button" variant="ghost">
        Cancel
      </Button>
      <Button disabled={saving || validationMessage !== null} type="submit">
        {saving ? <SpinnerGap className="spin" size={16} /> : null}
        {saving ? "Saving…" : "Save outfit"}
      </Button>
    </div>
  );
}

export function ManualOutfitForm({
  state,
  onClose,
}: {
  state: ReturnType<typeof useManualOutfitDialog>;
  onClose: () => void;
}) {
  const { wardrobe, selections, form, validationMessage } = state;
  return (
    <form className="form-grid" onSubmit={(event) => void form.submit(event, validationMessage)}>
      <ManualOutfitNameOccasionFields
        name={form.name}
        occasion={form.occasion}
        onName={form.setName}
        onOccasion={form.setOccasion}
        saving={form.saving}
      />
      <ManualOutfitFoundationSection state={state} />
      <ManualOutfitNotesField
        explanation={form.explanation}
        favorite={form.favorite}
        onExplanation={form.setExplanation}
        onFavorite={form.setFavorite}
        saving={form.saving}
      />
      <ManualOutfitNotes
        availableCount={wardrobe.availableCount}
        error={form.error}
        itemsCount={wardrobe.items.length}
        unresolvedCount={selections.unresolvedCount}
        validationMessage={validationMessage}
      />
      <ManualOutfitFooter
        onCancel={onClose}
        saving={form.saving}
        validationMessage={validationMessage}
      />
    </form>
  );
}

function ManualOutfitLoadState({
  loading,
  error,
  hasItems,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  hasItems: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div className="inline-feedback" role="status">
        <SpinnerGap className="spin" size={17} />
        <span>Loading available wardrobe pieces…</span>
      </div>
    );
  }
  if (error && !hasItems) {
    return (
      <div className="inline-feedback inline-feedback--error" role="alert">
        <WarningCircle size={17} />
        <span>{error}</span>
        <Button onClick={onRetry} variant="ghost">
          Try again
        </Button>
      </div>
    );
  }
  if (!hasItems) {
    return (
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
    );
  }
  return null;
}

function ManualOutfitDialogHeader({
  onClose,
  disabled,
}: {
  onClose: () => void;
  disabled: boolean;
}) {
  return (
    <div className="item-form-dialog__header">
      <div>
        <p className="eyebrow">Manual outfit</p>
        <h2 id="manual-outfit-title">Build from your wardrobe</h2>
      </div>
      <button
        aria-label="Close manual outfit builder"
        className="icon-button"
        disabled={disabled}
        onClick={onClose}
        type="button"
      >
        <X size={18} />
      </button>
    </div>
  );
}

export function ManualOutfitDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (outfit: OutfitRecord) => void;
}) {
  const state = useManualOutfitDialog(onSaved);
  const closeSafely = () => {
    if (!state.form.saving) onClose();
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
        <ManualOutfitDialogHeader disabled={state.form.saving} onClose={closeSafely} />
        <ManualOutfitLoadState
          error={state.wardrobe.error}
          hasItems={state.wardrobe.items.length > 0}
          loading={state.wardrobe.loading}
          onRetry={() => state.wardrobe.setRetry((value) => value + 1)}
        />
        {!state.wardrobe.loading && state.wardrobe.items.length > 0 ? (
          <ManualOutfitForm onClose={closeSafely} state={state} />
        ) : null}
      </section>
    </div>
  );
}

export function OutfitCard({
  outfit,
  sample = false,
  actions,
}: {
  outfit: OutfitPreview;
  sample?: boolean;
  actions?: ReactNode;
}) {
  return (
    <article className="outfit-card">
      <div className="outfit-card__canvas">
        <div className="outfit-card__pieces">
          {outfit.pieces.map((piece, index) => (
            <GarmentArtwork compact key={`${piece.category}-${index}`} {...piece} />
          ))}
        </div>
        {sample ? <Badge tone="outline">Sample look</Badge> : null}
        {outfit.favorite ? (
          <Heart
            className="outfit-card__heart"
            size={19}
            weight="fill"
            aria-label="Favorite outfit"
          />
        ) : null}
      </div>
      <div className="outfit-card__body">
        <p className="eyebrow">{outfit.occasion}</p>
        <h3>{outfit.name}</h3>
        <p>{outfit.detail}</p>
        {actions ? (
          <div className="outfit-card__actions">{actions}</div>
        ) : (
          <Link href={`/outfits?look=${outfit.id}`}>
            View look <ArrowRight size={15} />
          </Link>
        )}
      </div>
    </article>
  );
}

export function OutfitCardActionButtons({
  outfit,
  busy,
  onToggleFavorite,
  onMarkWorn,
  onDelete,
}: {
  outfit: OutfitRecord;
  busy: boolean;
  onToggleFavorite: () => void;
  onMarkWorn: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <Button
        aria-label={`${outfit.favorite ? "Remove" : "Add"} ${outfit.name} ${outfit.favorite ? "from" : "to"} favorites`}
        disabled={busy}
        onClick={onToggleFavorite}
        variant="ghost"
      >
        <Heart size={14} weight={outfit.favorite ? "fill" : "regular"} />
        {outfit.favorite ? "Favorited" : "Favorite"}
      </Button>
      <Button disabled={busy} onClick={onMarkWorn} variant="secondary">
        {busy ? <SpinnerGap className="spin" size={14} /> : <CheckCircle size={14} />}
        Mark worn
      </Button>
      <Button
        aria-label={`Delete ${outfit.name}`}
        disabled={busy}
        onClick={onDelete}
        variant="ghost"
      >
        <Trash size={14} />
      </Button>
    </>
  );
}

function OutfitOccasionSelect({
  occasion,
  onOccasion,
  occasions,
}: {
  occasion: string;
  onOccasion: (value: string) => void;
  occasions: string[];
}) {
  return (
    <select
      aria-label="Filter outfits by occasion"
      onChange={(event) => onOccasion(event.target.value)}
      value={occasion}
    >
      <option value="">All occasions</option>
      {occasions.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
    </select>
  );
}

function OutfitsToolbar({
  search,
  onSearch,
  occasion,
  onOccasion,
  occasions,
  sort,
  onSort,
}: {
  search: string;
  onSearch: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
  occasions: string[];
  sort: string;
  onSort: (value: string) => void;
}) {
  return (
    <div className="outfit-toolbar">
      <label>
        <MagnifyingGlass size={17} />
        <span className="sr-only">Search outfits</span>
        <input
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search outfits"
          type="search"
          value={search}
        />
      </label>
      <OutfitOccasionSelect occasion={occasion} occasions={occasions} onOccasion={onOccasion} />
      <select
        aria-label="Sort outfits"
        onChange={(event) => onSort(event.target.value)}
        value={sort}
      >
        <option value="recent">Recently saved</option>
        <option value="name">Name A–Z</option>
        <option value="favorite">Favorites first</option>
      </select>
    </div>
  );
}

function OutfitTabs({
  activeFilter,
  onChange,
  total,
}: {
  activeFilter: OutfitFilter;
  onChange: (filter: OutfitFilter) => void;
  total: number;
}) {
  const tab = (filter: OutfitFilter, label: ReactNode) => (
    <button
      className={activeFilter === filter ? "is-active" : ""}
      onClick={() => onChange(filter)}
      role="tab"
      aria-selected={activeFilter === filter}
      type="button"
    >
      {label} {activeFilter === filter ? <span>{total}</span> : null}
    </button>
  );
  return (
    <div className="outfit-tabs" role="tablist" aria-label="Outfit categories">
      {tab("all", "All looks")}
      {tab(
        "favorite",
        <>
          <Heart size={15} /> Favorites
        </>,
      )}
      {tab("worn", "Worn history")}
      {tab("ai", "AI created")}
    </div>
  );
}

export function OutfitsFilterBar({ state }: { state: ReturnType<typeof useOutfitsManagerState> }) {
  return (
    <>
      <OutfitTabs
        activeFilter={state.activeFilter}
        onChange={state.setActiveFilter}
        total={state.total}
      />
      <OutfitsToolbar
        occasion={state.occasion}
        occasions={state.occasions}
        onOccasion={state.setOccasion}
        onSearch={state.setSearch}
        onSort={state.setSort}
        search={state.search}
        sort={state.sort}
      />
    </>
  );
}

export function OutfitsHeaderActions({ onBuildManually }: { onBuildManually?: () => void }) {
  return (
    <>
      <Button disabled={!onBuildManually} onClick={onBuildManually} variant="secondary">
        <Plus size={16} /> Build manually
      </Button>
      {onBuildManually ? (
        <ButtonLink href="/stylist">
          <Sparkle size={16} /> Generate outfits
        </ButtonLink>
      ) : (
        <Button disabled>
          <Sparkle size={16} /> Generate outfits
        </Button>
      )}
    </>
  );
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

function OutfitsEmptyState({
  hasQuery,
  onClearFilters,
  onBuildManually,
}: {
  hasQuery: boolean;
  onClearFilters: () => void;
  onBuildManually: () => void;
}) {
  return (
    <section className="empty-state">
      <span className="empty-state__icon">
        <Sparkle size={25} weight="light" />
      </span>
      <h2>{hasQuery ? "No matching outfits" : "No saved outfits yet"}</h2>
      <p>
        {hasQuery
          ? "Try another search or clear the occasion filter."
          : "Ask the stylist for a look made only from your saved, available wardrobe items."}
      </p>
      <div className="empty-state__action">
        {hasQuery ? (
          <Button onClick={onClearFilters} variant="secondary">
            Clear filters
          </Button>
        ) : (
          <div className="outfit-empty-actions">
            <Button onClick={onBuildManually} variant="secondary">
              <Plus size={16} /> Build manually
            </Button>
            <ButtonLink href="/stylist">Open the stylist</ButtonLink>
          </div>
        )}
      </div>
    </section>
  );
}

function OutfitsGrid({
  outfits,
  actions,
}: {
  outfits: OutfitRecord[];
  actions: ReturnType<typeof useOutfitCardActions>;
}) {
  return (
    <section className="outfit-grid" aria-label="Saved outfits">
      {outfits.map((outfit) => {
        const busy = actions.busyId === outfit.id;
        return (
          <OutfitCard
            actions={
              <OutfitCardActionButtons
                busy={busy}
                onDelete={() => actions.remove(outfit)}
                onMarkWorn={() => void actions.markWorn(outfit)}
                onToggleFavorite={() => void actions.toggleFavorite(outfit)}
                outfit={outfit}
              />
            }
            key={outfit.id}
            outfit={asPreview(outfit)}
          />
        );
      })}
    </section>
  );
}

export function OutfitsResults({ state }: { state: ReturnType<typeof useOutfitsManagerState> }) {
  if (state.loading) {
    return (
      <div className="inline-feedback" role="status">
        <SpinnerGap className="spin" size={17} />
        <span>Loading saved outfits…</span>
      </div>
    );
  }
  if (!state.visibleOutfits.length) {
    return (
      <OutfitsEmptyState
        hasQuery={Boolean(state.search || state.occasion)}
        onBuildManually={() => state.setBuilderOpen(true)}
        onClearFilters={() => {
          state.setSearch("");
          state.setOccasion("");
        }}
      />
    );
  }
  return <OutfitsGrid actions={state.actions} outfits={state.visibleOutfits} />;
}

function handleManualOutfitSaved(
  state: ReturnType<typeof useOutfitsManagerState>,
  saved: OutfitRecord,
) {
  state.setBuilderOpen(false);
  state.actions.setNotice(`“${saved.name}” was saved to your outfits.`);
  if (state.activeFilter === "all") {
    state.setOutfits((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
    state.setTotal((current) => current + 1);
  } else {
    state.setActiveFilter("all");
  }
}

function OutfitsNotices({
  error,
  notice,
  onRetry,
}: {
  error: string | null;
  notice: string | null;
  onRetry: () => void;
}) {
  return (
    <>
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} />
          <span>{error}</span>
          <Button onClick={onRetry} variant="ghost">
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
  const state = useOutfitsManagerState(configured);

  if (!configured) return <PreviewOutfits outfits={previewOutfits} />;

  return (
    <>
      <PageHeader
        eyebrow="Saved combinations"
        title="Outfits"
        description="Keep the looks that work, revisit favorites, and learn from what you actually wear."
        actions={<OutfitsHeaderActions onBuildManually={() => state.setBuilderOpen(true)} />}
      />
      <OutfitsFilterBar state={state} />
      <OutfitsNotices
        error={state.error ?? state.actions.error}
        notice={state.actions.notice}
        onRetry={() => state.setRetry((value) => value + 1)}
      />
      <OutfitsResults state={state} />
      {state.builderOpen ? (
        <ManualOutfitDialog
          onClose={() => state.setBuilderOpen(false)}
          onSaved={(saved) => handleManualOutfitSaved(state, saved)}
        />
      ) : null}
    </>
  );
}

function PreviewOutfitsEmptyPrompt() {
  return (
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
  );
}

function PreviewOutfitTabs({ total }: { total: number }) {
  return (
    <div className="outfit-tabs" role="tablist" aria-label="Preview outfit categories">
      <button className="is-active" role="tab" aria-selected="true" type="button">
        All looks <span>{total}</span>
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
  );
}

function PreviewOutfitsToolbar() {
  return (
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
  );
}

export function PreviewOutfits({ outfits }: { outfits: OutfitPreview[] }) {
  return (
    <>
      <PageHeader
        eyebrow="Saved combinations"
        title="Outfits"
        description="Keep the looks that work, revisit favorites, and learn from what you actually wear."
        meta={<PreviewBadge />}
        actions={<OutfitsHeaderActions />}
      />
      <DemoNotice>
        Preview mode: these looks are labeled samples. Configure Supabase to load and manage your
        saved outfits.
      </DemoNotice>
      <PreviewOutfitTabs total={outfits.length} />
      <PreviewOutfitsToolbar />
      <section className="outfit-grid" aria-label="Sample saved outfits">
        {outfits.map((outfit) => (
          <OutfitCard key={outfit.id} outfit={outfit} sample />
        ))}
      </section>
      <PreviewOutfitsEmptyPrompt />
    </>
  );
}
