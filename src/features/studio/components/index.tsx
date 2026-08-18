"use client";

import type { ComposerState } from "./studio-ui-model";
import { Lock, LockOpen } from "@phosphor-icons/react";
import type { StudioVariantItem } from "../types";
import { ROLE_LABELS } from "./studio-ui-model";
import type { StudioVariant } from "../types";
import { useEffect, useState } from "react";
import { fetchItemCutouts } from "../api";
import Link from "next/link";
import { ArrowsClockwise, Heart } from "@phosphor-icons/react";
import { Button } from "@/components/ui";
import type { StudioGarmentDetail } from "../types";
import { AVAILABILITY_LABELS } from "./studio-ui-model";
import { useRef, type RefObject } from "react";
import { X } from "@phosphor-icons/react";
import {
  hotspotBounds,
  projectNormalizedRect,
  type GarmentHotspot,
  type Size,
} from "@/lib/visualization";
import { CONSENT_POINTS, CONSENT_STATEMENT } from "./studio-ui-model";
import { useInteractiveImage } from "./studio-ui-model";
import { useCallback } from "react";
import { OCCASION_CHIPS, VIBE_CHIPS } from "./studio-ui-model";
import type { OutfitVariantMode } from "../types";
import { MODE_DESCRIPTIONS, MODE_LABELS } from "./studio-ui-model";
import type { OutfitItemRole } from "@/features/outfits";
import { resolveWardrobeItemRole } from "@/features/wardrobe";
import { fetchAvailableItems, type SwapCandidate } from "../api";
import { Warning } from "@phosphor-icons/react";
import { markItemWorn, setItemFavorite } from "../api";
import type { StudioState } from "../hooks";
import { flatLayGarments } from "./studio-ui-model";
import {
  activateIdentityReference,
  fetchIdentityState,
  revokeIdentityReference,
  uploadIdentityPhoto,
} from "../api";
import type { IdentityState } from "../types";
import { PHOTO_GUIDANCE } from "./studio-ui-model";
import { submitFeedback } from "../api";
import type { StudioVisualization } from "../types";
import type { StudioMode } from "../hooks";
import { useStudio } from "../hooks";
import { useComposer } from "./studio-ui-model";

type ComposerChipsProps = {
  legend: string;
  options: readonly string[];
  isSelected: (option: string) => boolean;
  onToggle: (option: string) => void;
};

/**
 * Selection is conveyed by `aria-pressed` and a border change, not by colour
 * alone, so the state survives a monochrome or high-contrast rendering.
 */
export function ComposerChips({ legend, options, isSelected, onToggle }: ComposerChipsProps) {
  return (
    <fieldset className="composer-chips">
      <legend>{legend}</legend>
      <div className="composer-chips__row">
        {options.map((option) => {
          const selected = isSelected(option);
          return (
            <button
              aria-pressed={selected}
              className={`composer-chip${selected ? " composer-chip--on" : ""}`}
              key={option}
              onClick={() => onToggle(option)}
              type="button"
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

type IndoorOutdoor = "indoor" | "outdoor" | "mixed" | null;

const SETTINGS = [
  { value: "indoor", label: "Indoors" },
  { value: "outdoor", label: "Outdoors" },
  { value: "mixed", label: "A bit of both" },
] as const;

/** "Not sure" is a first-class answer: missing context is not a constraint. */
function ComposerSettingField({
  value,
  onChange,
}: {
  value: IndoorOutdoor;
  onChange: (next: IndoorOutdoor) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="studio-setting">Setting</label>
      </div>
      <select
        className="select-input"
        id="studio-setting"
        onChange={(event) => onChange((event.target.value || null) as IndoorOutdoor)}
        value={value ?? ""}
      >
        <option value="">Not sure</option>
        {SETTINGS.map((setting) => (
          <option key={setting.value} value={setting.value}>
            {setting.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function ComposerContextFields({ composer }: { composer: ComposerState }) {
  return (
    <div className="form-grid form-grid--two">
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="studio-date">Date</label>
        </div>
        <input
          className="text-input"
          id="studio-date"
          onChange={(event) => composer.setDate(event.target.value)}
          type="date"
          value={composer.date}
        />
      </div>
      <div className="form-field">
        <div className="form-field__label-row">
          <label htmlFor="studio-location">Where</label>
          <span>Optional</span>
        </div>
        <input
          className="text-input"
          id="studio-location"
          onChange={(event) => composer.setLocation(event.target.value)}
          placeholder="Uses your saved location"
          value={composer.location}
        />
      </div>
      <ComposerSettingField onChange={composer.setIndoorOutdoor} value={composer.indoorOutdoor} />
    </div>
  );
}

type FlatLayPieceProps = {
  item: StudioVariantItem;
  cutoutUrl: string | undefined;
  locked: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
};

export function FlatLayPiece({
  item,
  cutoutUrl,
  locked,
  selected,
  onSelect,
  onToggleLock,
}: FlatLayPieceProps) {
  return (
    <div className={`flat-lay__piece${selected ? " flat-lay__piece--selected" : ""}`}>
      <button
        className="flat-lay__figure"
        onClick={onSelect}
        type="button"
        aria-pressed={selected}
        aria-label={`${ROLE_LABELS[item.role]}: ${item.name}. Open details.`}
      >
        {cutoutUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL
          <img alt="" src={cutoutUrl} loading="lazy" />
        ) : (
          <span className="flat-lay__placeholder" aria-hidden="true">
            No cut-out yet
          </span>
        )}
      </button>
      <button
        className={`flat-lay__lock${locked ? " flat-lay__lock--on" : ""}`}
        onClick={onToggleLock}
        type="button"
        aria-pressed={locked}
        aria-label={locked ? `Unlock ${item.name}` : `Lock ${item.name}`}
      >
        {locked ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
        <span>{locked ? "Locked" : "Lock"}</span>
      </button>
      <p className="flat-lay__caption">
        <span>{ROLE_LABELS[item.role]}</span>
        <strong>{item.name}</strong>
      </p>
    </div>
  );
}

/**
 * Signed cut-out URLs for the flat lay. Signed URLs are short-lived and never
 * persisted, so this refetches whenever the set of item IDs changes rather
 * than caching them anywhere.
 */
function useCutouts(itemIds: readonly string[]) {
  const key = [...itemIds].sort().join(",");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const { cutouts } = await fetchItemCutouts(key.split(","), controller.signal);
        setUrls(Object.fromEntries(cutouts.map((entry) => [entry.itemId, entry.url])));
      } catch {
        // The flat lay falls back to a labelled placeholder per garment.
      }
    })();
    return () => controller.abort();
  }, [key]);

  return urls;
}

type FlatLayStageProps = {
  variant: StudioVariant;
  selectedItemId: string | null;
  isLocked: (itemId: string) => boolean;
  onSelect: (itemId: string) => void;
  onToggleLock: (role: StudioVariant["items"][number]["role"], itemId: string) => void;
};

/**
 * The immediate view: real garment cut-outs composed deterministically. It
 * makes no image-generation call and needs no consent, so a look is inspectable
 * the moment it is recommended.
 */
export function FlatLayStage({
  variant,
  selectedItemId,
  isLocked,
  onSelect,
  onToggleLock,
}: FlatLayStageProps) {
  const cutouts = useCutouts(variant.items.map((item) => item.itemId));

  return (
    <div className="flat-lay" data-testid="flat-lay">
      <div className="flat-lay__grid">
        {variant.items.map((item) => (
          <FlatLayPiece
            key={item.itemId}
            item={item}
            cutoutUrl={cutouts[item.itemId]}
            locked={isLocked(item.itemId)}
            selected={selectedItemId === item.itemId}
            onSelect={() => onSelect(item.itemId)}
            onToggleLock={() => onToggleLock(item.role, item.itemId)}
          />
        ))}
      </div>
    </div>
  );
}

type GarmentDetailActionsProps = {
  garment: StudioGarmentDetail;
  locked: boolean;
  busy: boolean;
  onToggleLock: () => void;
  onSwap: () => void;
  onFavorite: () => void;
  onMarkWorn: () => void;
};

export function GarmentDetailActions({
  garment,
  locked,
  busy,
  onToggleLock,
  onSwap,
  onFavorite,
  onMarkWorn,
}: GarmentDetailActionsProps) {
  const favorite = garment.item?.favorite === true;

  return (
    <div className="garment-detail__actions">
      <Link className="button button--secondary button--small" href={`/wardrobe/${garment.itemId}`}>
        View clothing
      </Link>
      <Button disabled={busy} onClick={onSwap} variant="ghost" className="button--small">
        <ArrowsClockwise size={14} /> Swap
      </Button>
      <Button onClick={onToggleLock} variant="ghost" className="button--small">
        {locked ? <Lock size={14} weight="fill" /> : <LockOpen size={14} />}
        {locked ? "Unlock" : "Lock"}
      </Button>
      <Button disabled={busy} onClick={onFavorite} variant="ghost" className="button--small">
        <Heart size={14} weight={favorite ? "fill" : "regular"} />
        {favorite ? "Unfavorite" : "Favorite"}
      </Button>
      <Button disabled={busy} onClick={onMarkWorn} variant="ghost" className="button--small">
        Mark worn
      </Button>
    </div>
  );
}

type Fact = { label: string; value: string };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function list(value: unknown): string | null {
  return Array.isArray(value) && value.length > 0 ? value.map(String).join(", ") : null;
}

/**
 * Builds the detail rows from the owned wardrobe record only. Nothing here is
 * read from the generated image or from the localization model — a rendered
 * pixel must never become a product fact about a garment the user owns.
 */
function garmentFacts(item: Record<string, unknown> | null): Fact[] {
  if (!item) return [];
  const materials = item.materials;
  const candidates: [string, string | null][] = [
    ["Brand", text(item.brand)],
    ["Category", text(item.subcategory) ?? text(item.category)],
    ["Colors", list(item.color_names)],
    ["Pattern", text(item.pattern)],
    ["Fit", text(item.fit)],
    ["Silhouette", text(item.silhouette)],
    ["Material", Array.isArray(materials) ? list(materials) : null],
    ["Size", text(item.size_label)],
    ["Care", list(item.care_instructions)],
    ["Status", AVAILABILITY_LABELS[String(item.availability_status)] ?? null],
    ["Worn", typeof item.wear_count === "number" ? `${item.wear_count} times` : null],
    [
      "Last worn",
      text(item.last_worn_at) ? new Date(String(item.last_worn_at)).toLocaleDateString() : null,
    ],
  ];
  return candidates.flatMap(([label, value]) => (value ? [{ label, value }] : []));
}

/** True when the item's metadata is uncertain enough to be worth flagging. */
function hasLowConfidenceMetadata(item: Record<string, unknown> | null): boolean {
  const confidence = item?.metadata_confidence;
  return typeof confidence === "number" && confidence < 0.6;
}

export function GarmentDetailBody({ garment }: { garment: StudioGarmentDetail }) {
  const facts = garmentFacts(garment.item);

  return (
    <>
      <div className="garment-detail__head">
        {garment.cutoutUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL
          <img alt="" className="garment-detail__cutout" src={garment.cutoutUrl} />
        ) : null}
        <div>
          <p className="garment-detail__role">{ROLE_LABELS[garment.role]}</p>
          <h3 className="garment-detail__name">
            {(garment.item?.name as string) ?? "This piece is no longer in your wardrobe"}
          </h3>
        </div>
      </div>

      {!garment.available ? (
        <p className="inline-feedback inline-feedback--error">
          <span>This piece is no longer active in your wardrobe.</span>
        </p>
      ) : null}

      {facts.length > 0 ? (
        <dl className="garment-detail__facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {hasLowConfidenceMetadata(garment.item) ? (
        <p className="garment-detail__confidence">
          Some details for this piece were suggested automatically and are not confirmed yet.
        </p>
      ) : null}
    </>
  );
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps Tab inside a sheet and returns focus to whatever opened it. Without
 * the restore step a keyboard user is dropped at the top of the document every
 * time they close a garment sheet.
 */
function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const opener = document.activeElement as HTMLElement | null;
    const focusable = () => [...(container?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])];
    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      opener?.focus?.();
    };
  }, [active, containerRef, onDismiss]);
}

type GarmentDetailSheetProps = {
  garment: StudioGarmentDetail;
  locked: boolean;
  busy: boolean;
  onDismiss: () => void;
  onToggleLock: () => void;
  onSwap: () => void;
  onFavorite: () => void;
  onMarkWorn: () => void;
};

/**
 * One component for both breakpoints. CSS turns it into an anchored side panel
 * from 961px up and a full-width bottom sheet below, so there is a single
 * focus-trap and dialog implementation rather than two that can drift apart.
 */
export function GarmentDetailSheet({ garment, onDismiss, ...actions }: GarmentDetailSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, true, onDismiss);

  return (
    <div
      aria-label={`Details for ${(garment.item?.name as string) ?? "this piece"}`}
      aria-modal="true"
      className="garment-detail"
      ref={containerRef}
      role="dialog"
    >
      <button
        aria-label="Close garment details"
        className="garment-detail__close icon-button"
        onClick={onDismiss}
        type="button"
      >
        <X size={16} />
      </button>
      <GarmentDetailBody garment={garment} />
      <GarmentDetailActions garment={garment} {...actions} />
    </div>
  );
}

type GarmentHotspotLayerProps = {
  hotspots: readonly GarmentHotspot[];
  natural: Size;
  container: Size;
  selectedItemId: string | null;
  nameFor: (itemId: string) => string;
};

/**
 * Purely decorative: the outlines mirror the current selection so a sighted
 * pointer user gets feedback, while the actual hit handling lives on the image
 * and the accessible selection lives in the chip list. `aria-hidden` keeps this
 * out of the accessibility tree so a screen reader is not read a second,
 * duplicate set of garments.
 */
export function GarmentHotspotLayer({
  hotspots,
  natural,
  container,
  selectedItemId,
  nameFor,
}: GarmentHotspotLayerProps) {
  return (
    <div className="tryon__hotspots" aria-hidden="true">
      {hotspots.map((hotspot) => {
        const rect = projectNormalizedRect(hotspotBounds(hotspot), natural, container);
        const active = hotspot.itemId === selectedItemId;
        return (
          <span
            className={`tryon__hotspot${active ? " tryon__hotspot--active" : ""}`}
            key={hotspot.itemId}
            style={{
              left: `${rect.left}px`,
              top: `${rect.top}px`,
              width: `${rect.width}px`,
              height: `${rect.height}px`,
              zIndex: hotspot.zIndex,
            }}
          >
            {active ? (
              <span className="tryon__hotspot-chip">
                {ROLE_LABELS[hotspot.role]} · {nameFor(hotspot.itemId)}
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

type GarmentSelectorChipsProps = {
  garments: readonly StudioGarmentDetail[];
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
};

/**
 * The accessible equivalent of clicking the image, and the reason the feature
 * still works when every hotspot is approximate. Real buttons, reachable with
 * Tab/Shift+Tab and activated with Enter/Space — no arrow-key emulation, no
 * pointer precision, and no dependence on localization succeeding.
 */
export function GarmentSelectorChips({
  garments,
  selectedItemId,
  onSelect,
}: GarmentSelectorChipsProps) {
  if (garments.length === 0) return null;

  return (
    <div className="garment-chips">
      <p className="garment-chips__label" id="garment-chips-label">
        Pieces in this look
      </p>
      <ul aria-labelledby="garment-chips-label" className="garment-chips__list">
        {garments.map((garment) => {
          const name = (garment.item?.name as string) ?? "Removed piece";
          const selected = garment.itemId === selectedItemId;
          return (
            <li key={garment.itemId}>
              <button
                aria-pressed={selected}
                className={`garment-chip${selected ? " garment-chip--selected" : ""}`}
                onClick={() => onSelect(garment.itemId)}
                type="button"
              >
                <span className="garment-chip__role">{ROLE_LABELS[garment.role]}</span>
                <span className="garment-chip__name">{name}</span>
                {selected ? <span className="sr-only">(selected)</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type IdentityConsentStepProps = {
  previewUrl: string | null;
  assessmentMessage: string | null;
  busy: boolean;
  onActivate: () => void;
};

/**
 * The user reviews the *normalized* photo — the one that will actually be
 * sent — and must tick an explicit box. A link or an implied acceptance is not
 * consent, so the activate button stays disabled until the box is checked.
 */
export function IdentityConsentStep({
  previewUrl,
  assessmentMessage,
  busy,
  onActivate,
}: IdentityConsentStepProps) {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="identity-step">
      <h3>Review and turn on AI try-on</h3>
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL
        <img alt="Your reference photo" className="identity-step__preview" src={previewUrl} />
      ) : null}
      {assessmentMessage ? <p className="identity-step__note">{assessmentMessage}</p> : null}
      <ul className="identity-step__guidance">
        {CONSENT_POINTS.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <label className="check-row">
        <input
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          type="checkbox"
        />
        <span>{CONSENT_STATEMENT}</span>
      </label>
      <Button disabled={!accepted || busy} onClick={onActivate}>
        {busy ? "Turning on…" : "Turn on AI try-on"}
      </Button>
    </div>
  );
}

type LayerChooserProps = {
  hotspots: readonly GarmentHotspot[];
  nameFor: (itemId: string) => string;
  onChoose: (itemId: string) => void;
  onDismiss: () => void;
};

/**
 * Shown only when two comparably sized layers genuinely overlap under the
 * pointer — an open coat over the top beneath it. Asking is better than
 * silently picking the outer layer and hiding the inner one.
 */
export function LayerChooser({ hotspots, nameFor, onChoose, onDismiss }: LayerChooserProps) {
  return (
    <div className="layer-chooser" role="dialog" aria-label="Which layer did you mean?">
      <p className="layer-chooser__title">Which layer?</p>
      <ul className="layer-chooser__list">
        {hotspots.map((hotspot) => (
          <li key={hotspot.itemId}>
            <button onClick={() => onChoose(hotspot.itemId)} type="button">
              <span className="layer-chooser__role">{ROLE_LABELS[hotspot.role]}</span>
              <span className="layer-chooser__name">{nameFor(hotspot.itemId)}</span>
            </button>
          </li>
        ))}
      </ul>
      <button className="layer-chooser__dismiss" onClick={onDismiss} type="button">
        Cancel
      </button>
    </div>
  );
}

/**
 * Tracks the image's intrinsic size and its container's CSS-pixel size so
 * hotspots can be projected exactly onto the painted area. Everything stays in
 * CSS pixels — device-pixel-ratio never enters the calculation, which is what
 * keeps the overlay aligned on a retina display.
 */
function useImageGeometry() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [natural, setNatural] = useState<Size | null>(null);
  const [container, setContainer] = useState<Size | null>(null);

  const onImageLoad = useCallback((event: { currentTarget: HTMLImageElement }) => {
    const image = event.currentTarget;
    setNatural({ width: image.naturalWidth, height: image.naturalHeight });
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setContainer({ width: box.width, height: box.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { containerRef, natural, container, onImageLoad };
}

type InteractiveTryOnImageProps = {
  imageUrl: string;
  garments: readonly StudioGarmentDetail[];
  selectedItemId: string | null;
  onSelect: (itemId: string) => void;
};

/**
 * Clicking is an enhancement, never the only route: the garment chips below
 * the image select the same pieces without any pointer precision, which is
 * what keeps the feature usable when localization is approximate.
 */
export function InteractiveTryOnImage({
  imageUrl,
  garments,
  selectedItemId,
  onSelect,
}: InteractiveTryOnImageProps) {
  const { containerRef, natural, container, onImageLoad } = useImageGeometry();
  const { hotspots, ambiguous, choose, onPointer, dismissChooser, nameFor } = useInteractiveImage(
    garments,
    natural,
    container,
    onSelect,
  );

  return (
    <div className="tryon__frame" ref={containerRef}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived private URL */}
      <img
        alt="AI style visualization of the selected outfit"
        className="tryon__image"
        onClick={onPointer}
        onLoad={onImageLoad}
        src={imageUrl}
      />
      {natural && container ? (
        <GarmentHotspotLayer
          container={container}
          hotspots={hotspots}
          natural={natural}
          nameFor={nameFor}
          selectedItemId={selectedItemId}
        />
      ) : null}
      {ambiguous ? (
        <LayerChooser
          hotspots={ambiguous}
          nameFor={nameFor}
          onChoose={choose}
          onDismiss={dismissChooser}
        />
      ) : null}
    </div>
  );
}

type OutfitActionDockProps = {
  mode: "flat-lay" | "try-on";
  canVisualize: boolean;
  busy: boolean;
  saved: boolean;
  hasLocks: boolean;
  onSave: () => void;
  onWearToday: () => void;
  onPlan: () => void;
  onTryOn: () => void;
  onRemix: () => void;
};

/**
 * Sticky on mobile, inline on desktop. Every control keeps a visible text
 * label — an icon-only primary action fails the 44×44 target guidance and
 * gives a screen reader nothing useful to announce.
 */
export function OutfitActionDock(props: OutfitActionDockProps) {
  return (
    <div className="action-dock">
      <Button disabled={props.busy || !props.canVisualize} onClick={props.onTryOn}>
        {props.mode === "try-on" ? "Update try-on" : "Try it on"}
      </Button>
      <Button disabled={props.busy} onClick={props.onSave} variant="secondary">
        {props.saved ? "Saved" : "Save look"}
      </Button>
      <Button disabled={props.busy || !props.saved} onClick={props.onWearToday} variant="ghost">
        Wear today
      </Button>
      <Button disabled={props.busy || !props.saved} onClick={props.onPlan} variant="ghost">
        Plan for a date
      </Button>
      <Button disabled={props.busy} onClick={props.onRemix} variant="ghost">
        {props.hasLocks ? "Remix the rest" : "Remix"}
      </Button>
    </div>
  );
}

function ComposerRequestField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="form-field">
      <div className="form-field__label-row">
        <label htmlFor="studio-request">Where are you going?</label>
        <span>Optional</span>
      </div>
      <textarea
        className="textarea-input"
        id="studio-request"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Dinner with friends after work, somewhere a bit smart"
        value={value}
      />
      <p className="form-field__hint">
        Plain language works. Anything you leave out is filled in from your preferences and the
        forecast.
      </p>
    </div>
  );
}

type OutfitRequestComposerProps = {
  composer: ComposerState;
  busy: boolean;
  onSubmit: (surprise: boolean) => void;
};

export function OutfitRequestComposer({ composer, busy, onSubmit }: OutfitRequestComposerProps) {
  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(false);
      }}
    >
      <ComposerRequestField onChange={composer.setMessage} value={composer.message} />
      <ComposerChips
        isSelected={(option) => composer.occasion === option}
        legend="Occasion"
        onToggle={(option) => composer.setOccasion(composer.occasion === option ? null : option)}
        options={OCCASION_CHIPS}
      />
      <ComposerChips
        isSelected={(option) => composer.vibes.includes(option)}
        legend="Vibe"
        onToggle={composer.toggleVibe}
        options={VIBE_CHIPS}
      />
      <ComposerContextFields composer={composer} />

      <div className="composer__actions">
        <Button disabled={busy} type="submit">
          {busy ? "Finding looks…" : "Show me three looks"}
        </Button>
        <Button disabled={busy} onClick={() => onSubmit(true)} variant="ghost">
          Surprise me
        </Button>
      </div>
    </form>
  );
}

type RecommendationVariantTabsProps = {
  variants: readonly StudioVariant[];
  mode: OutfitVariantMode;
  onSelect: (mode: OutfitVariantMode) => void;
};

/**
 * A real tablist: arrow keys are handled by the browser's roving focus through
 * `tabindex`, and the selected state is carried by `aria-selected` rather than
 * by colour alone.
 */
export function RecommendationVariantTabs({
  variants,
  mode,
  onSelect,
}: RecommendationVariantTabsProps) {
  if (variants.length === 0) return null;

  return (
    <div aria-label="Look styles" className="variant-tabs" role="tablist">
      {variants.map((variant) => {
        const selected = variant.mode === mode;
        return (
          <button
            aria-controls="studio-stage"
            aria-selected={selected}
            className={`variant-tab${selected ? " variant-tab--on" : ""}`}
            id={`variant-tab-${variant.mode}`}
            key={variant.mode}
            onClick={() => onSelect(variant.mode)}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="variant-tab__label">{MODE_LABELS[variant.mode]}</span>
            <span className="variant-tab__description">{MODE_DESCRIPTIONS[variant.mode]}</span>
          </button>
        );
      })}
    </div>
  );
}

type OutfitSwapPickerProps = {
  role: OutfitItemRole;
  currentItemId: string;
  onSwap: (replacement: SwapCandidate) => void;
  onDismiss: () => void;
};

/**
 * Only role-compatible, active, available owned items appear. Anything that
 * would break the foundation rule is filtered out here and rejected again by
 * the server, so a swap can never leave the outfit in an invalid state.
 */
export function OutfitSwapPicker({
  role,
  currentItemId,
  onSwap,
  onDismiss,
}: OutfitSwapPickerProps) {
  const [candidates, setCandidates] = useState<SwapCandidate[] | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const { items } = await fetchAvailableItems();
        setCandidates(
          items.filter(
            (item) => item.id !== currentItemId && resolveWardrobeItemRole(item) === role,
          ),
        );
      } catch {
        setCandidates([]);
      }
    })();
  }, [role, currentItemId]);

  return (
    <div className="swap-picker" role="dialog" aria-label={`Swap this ${role}`}>
      <p className="swap-picker__title">Swap this {role}</p>
      {candidates === null ? <p>Loading your options…</p> : null}
      {candidates?.length === 0 ? <p>No other available {role} fits here right now.</p> : null}
      <ul className="swap-picker__list">
        {(candidates ?? []).map((candidate) => (
          <li key={candidate.id}>
            <button onClick={() => onSwap(candidate)} type="button">
              {candidate.name}
            </button>
          </li>
        ))}
      </ul>
      <Button className="button--small" onClick={onDismiss} variant="ghost">
        Cancel
      </Button>
    </div>
  );
}

/**
 * Reasons and warnings only. Deliberately shows no score or percentage: an
 * internal ranking number presented as a consumer certainty reads as a promise
 * the system cannot keep.
 */
export function OutfitWhyPanel({ variant }: { variant: StudioVariant }) {
  return (
    <section className="why-panel">
      <p className="eyebrow">{MODE_LABELS[variant.mode]}</p>
      <h2 className="why-panel__title">{variant.title}</h2>
      {variant.stylistNote ? <p className="why-panel__note">{variant.stylistNote}</p> : null}

      {variant.reasons.length > 0 ? (
        <ul className="why-panel__reasons">
          {variant.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {variant.warnings.length > 0 ? (
        <ul className="why-panel__warnings">
          {variant.warnings.map((warning) => (
            <li key={warning}>
              <Warning aria-hidden="true" size={14} />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {variant.styleTags.length > 0 ? (
        <p className="why-panel__tags">
          {variant.styleTags.map((tag) => (
            <span className="badge badge--outline" key={tag}>
              {tag}
            </span>
          ))}
        </p>
      ) : null}
    </section>
  );
}

/**
 * The why-panel is always present — it is the answer to "why this look" and
 * should not vanish when a garment is inspected. The detail sheet renders
 * *in addition*: an anchored panel on desktop, a fixed bottom sheet on mobile.
 * Rendering it once rather than duplicating it per breakpoint keeps a single
 * heading in the accessibility tree.
 */
export function StudioDetailRail({ studio }: { studio: StudioState }) {
  const variant = studio.variants.selected;
  if (!variant) return null;

  const garments = studio.tryOn.visualization?.garments ?? flatLayGarments(variant.items);
  const selected = garments.find((garment) => garment.itemId === studio.selectedItemId) ?? null;

  return (
    <>
      <OutfitWhyPanel variant={variant} />

      {studio.swapping ? (
        <OutfitSwapPicker
          currentItemId={studio.swapping.itemId}
          onDismiss={() => studio.setSwapping(null)}
          onSwap={(replacement) => studio.swapItem(studio.swapping!.itemId, replacement)}
          role={studio.swapping.role}
        />
      ) : null}

      {selected && !studio.swapping ? (
        <GarmentDetailSheet
          busy={studio.actions.busy}
          garment={selected}
          locked={studio.locks.isLocked(selected.itemId)}
          onDismiss={() => studio.setSelectedItemId(null)}
          onFavorite={() =>
            void setItemFavorite(selected.itemId, selected.item?.favorite !== true).catch(
              () => null,
            )
          }
          onMarkWorn={() => void markItemWorn(selected.itemId).catch(() => null)}
          onSwap={() => studio.setSwapping({ role: selected.role, itemId: selected.itemId })}
          onToggleLock={() => studio.locks.toggleLock(selected.role, selected.itemId)}
        />
      ) : null}
    </>
  );
}

type TryOnConsentGateProps = { busy: boolean; onUpload: (file: File) => void };

function IdentityUploadStep({ busy, onUpload }: TryOnConsentGateProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="identity-step">
      <h3>Add a reference photo</h3>
      <p className="identity-step__lead">
        The try-on needs one photo of you so the generated image is recognizably you rather than a
        stock model.
      </p>
      <ul className="identity-step__guidance">
        {PHOTO_GUIDANCE.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <Button disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? "Checking your photo…" : "Choose a photo"}
      </Button>
    </div>
  );
}

function useIdentity() {
  const [state, setState] = useState<IdentityState | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const next = await fetchIdentityState(controller.signal);
        if (!controller.signal.aborted) setState(next);
      } catch {
        // The gate renders its unconfigured state; nothing else depends on this.
      }
    })();
    return () => controller.abort();
  }, [version]);

  const run = useCallback(async (action: () => Promise<string | null>) => {
    setBusy(true);
    try {
      setMessage(await action());
      setVersion((previous) => previous + 1);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    state,
    busy,
    message,
    upload: (file: File) =>
      run(async () => (await uploadIdentityPhoto(file)).assessment.userMessage),
    activate: (id: string) => run(async () => (await activateIdentityReference(id), null)),
    revoke: (deleteAssets: boolean) =>
      run(async () => (await revokeIdentityReference(deleteAssets), "AI try-on is turned off.")),
  };
}

/**
 * Consent enables the feature; it never enqueues a generation. Reaching the
 * "ready" state here only means the user *may* press Try it on.
 */
export function TryOnConsentGate({ onReady }: { onReady: () => void }) {
  const { state, busy, message, upload, activate, revoke } = useIdentity();

  if (!state) return <p className="identity-step__lead">Loading your try-on settings…</p>;
  if (!state.tryOnConfigured) {
    return (
      <p className="inline-feedback">
        <span>AI try-on is not configured on this deployment yet. The flat lay still works.</span>
      </p>
    );
  }

  if (state.active && state.consentCurrent) {
    return (
      <div className="identity-step">
        <h3>AI try-on is on</h3>
        <p className="identity-step__lead">
          Your reference photo is stored privately and used only when you ask for a try-on.
        </p>
        <div className="identity-step__actions">
          <Button onClick={onReady}>Create a try-on</Button>
          <Button disabled={busy} onClick={() => void revoke(true)} variant="danger">
            Turn off and delete my photo
          </Button>
        </div>
        {message ? <p className="identity-step__note">{message}</p> : null}
      </div>
    );
  }

  if (state.pending) {
    return (
      <IdentityConsentStep
        assessmentMessage={message}
        busy={busy}
        onActivate={() => void activate(state.pending!.id)}
        previewUrl={state.previewUrl}
      />
    );
  }

  return <IdentityUploadStep busy={busy} onUpload={(file) => void upload(file)} />;
}

const STEPS = [
  { status: "validating_inputs", label: "Preparing your exact pieces" },
  { status: "generating", label: "Creating the try-on" },
  { status: "qa_review", label: "Checking garment and identity fidelity" },
  { status: "localizing", label: "Mapping interactive garment details" },
] as const;

/**
 * Named steps, not a fabricated percentage. The backend genuinely moves
 * through these stages, so each one is truthful; a fake progress bar would
 * only be guessing at how long a two-minute image call has left.
 */
export function TryOnProgress({ status }: { status: string }) {
  const activeIndex = STEPS.findIndex((step) => step.status === status);

  return (
    <div className="tryon-progress">
      <ol className="tryon-progress__steps">
        {STEPS.map((step, index) => {
          const state = index < activeIndex ? "done" : index === activeIndex ? "active" : "pending";
          return (
            <li className={`tryon-progress__step tryon-progress__step--${state}`} key={step.status}>
              <span aria-hidden="true" className="tryon-progress__marker" />
              {step.label}
              {state === "done" ? <span className="sr-only"> (finished)</span> : null}
              {state === "active" ? <span className="sr-only"> (in progress)</span> : null}
            </li>
          );
        })}
      </ol>
      <p className="tryon-progress__note">
        High-quality image generation can take up to about two minutes. You can leave this page and
        come back — the try-on keeps going.
      </p>
    </div>
  );
}

const REASONS = [
  { value: "looks_like_me", label: "Looks like me" },
  { value: "does_not_look_like_me", label: "Doesn't look like me" },
  { value: "wrong_garment", label: "Wrong garment" },
  { value: "missing_garment", label: "Missing garment" },
  { value: "bad_anatomy", label: "Bad anatomy or pose" },
  { value: "styling_not_for_me", label: "Styling isn't for me" },
  { value: "other", label: "Something else" },
] as const;

export function TryOnFeedback({ visualizationId }: { visualizationId: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (reason: string) => {
    setBusy(true);
    try {
      await submitFeedback(visualizationId, reason, null);
      setSent(reason);
    } catch {
      setSent(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tryon-feedback">
      <p className="tryon-feedback__label">How did this turn out?</p>
      <div className="tryon-feedback__options">
        {REASONS.map((reason) => (
          <Button
            className="button--small"
            disabled={busy}
            key={reason.value}
            onClick={() => void send(reason.value)}
            variant={sent === reason.value ? "secondary" : "ghost"}
          >
            {reason.label}
          </Button>
        ))}
      </div>
      <p aria-live="polite" className="tryon-feedback__ack">
        {sent ? "Thanks — that helps us improve the try-on." : ""}
      </p>
    </div>
  );
}

/**
 * A stale image is never presented as current. The old visualization stays
 * visible — it is still useful context — but it is labelled and paired with
 * the one action that fixes it.
 */
function StaleTryOnNotice({
  staleReason,
  busy,
  onRegenerate,
}: {
  staleReason: string | null;
  busy: boolean;
  onRegenerate: () => void;
}) {
  return (
    <div className="tryon-notice tryon-notice--stale" role="status">
      <p className="tryon-notice__title">This try-on is out of date.</p>
      <p className="tryon-notice__detail">
        {staleReason === "identity_reference_replaced"
          ? "You changed your reference photo, so this image no longer shows you."
          : "A piece in this look changed, so this image no longer shows the current outfit."}
      </p>
      <Button className="button--small" disabled={busy} onClick={onRegenerate}>
        Update try-on
      </Button>
    </div>
  );
}

type TryOnReadyProps = {
  visualization: StudioVisualization;
  selectedItemId: string | null;
  busy: boolean;
  onSelect: (itemId: string) => void;
  onRegenerate: () => void;
};

export function TryOnReady({
  visualization,
  selectedItemId,
  busy,
  onSelect,
  onRegenerate,
}: TryOnReadyProps) {
  return (
    <div className="tryon-ready">
      {visualization.status === "stale" ? (
        <StaleTryOnNotice
          busy={busy}
          onRegenerate={onRegenerate}
          staleReason={visualization.staleReason}
        />
      ) : null}

      {visualization.imageUrl ? (
        <InteractiveTryOnImage
          garments={visualization.garments}
          imageUrl={visualization.imageUrl}
          onSelect={onSelect}
          selectedItemId={selectedItemId}
        />
      ) : null}

      <p className="tryon-disclaimer">{visualization.disclaimer}</p>

      <div className="tryon-ready__actions">
        <a
          className="button button--ghost button--small"
          download
          href={`/api/outfit-visualizations/${visualization.id}/download`}
        >
          Download privately
        </a>
      </div>

      <TryOnFeedback visualizationId={visualization.id} />
    </div>
  );
}

type TryOnStatusNoticeProps = {
  errorCode: string | null;
  errorSummary: string | null;
  busy: boolean;
  onRetry: () => void;
  onChangePhoto: () => void;
  onChangeOutfit: () => void;
  onBackToFlatLay: () => void;
};

/**
 * Each failure gets its own recovery action. A blanket "Retry" on a moderation
 * block or a missing cut-out sends the user round a loop that cannot succeed,
 * so only the actions that can actually help are offered.
 */
type FailureAction = "retry" | "change_photo" | "change_outfit" | "flat_lay";

const FAILURE_COPY: Record<string, { title: string; actions: FailureAction[] }> = {
  configuration_missing: {
    title: "AI try-on is not available on this deployment yet.",
    actions: ["flat_lay"],
  },
  authentication: { title: "The image service rejected our credentials.", actions: ["flat_lay"] },
  unsupported_capability: {
    title: "The configured image model cannot render this outfit.",
    actions: ["change_outfit", "flat_lay"],
  },
  input_validation: {
    title: "One of the images could not be used.",
    actions: ["change_photo", "change_outfit"],
  },
  moderation_blocked: {
    title: "The safety system blocked this request.",
    actions: ["change_photo", "flat_lay"],
  },
  rate_limited: { title: "The image service is busy right now.", actions: ["retry"] },
  provider_transient: { title: "The image service is temporarily down.", actions: ["retry"] },
  timeout: { title: "The image service timed out.", actions: ["retry"] },
  invalid_output: { title: "The generated image came back unusable.", actions: ["retry"] },
  qa_rejected: {
    title: "The try-on did not pass our fidelity check, so we did not show it.",
    actions: ["retry", "change_photo"],
  },
  retry_exhausted: {
    title: "We tried several times and could not finish this try-on.",
    actions: ["change_photo", "change_outfit", "flat_lay"],
  },
  consent_revoked: { title: "AI try-on is turned off for this account.", actions: ["flat_lay"] },
};

const DEFAULT_FAILURE = {
  title: "The try-on could not be completed.",
  actions: ["retry", "flat_lay"] as FailureAction[],
};

const ACTION_LABELS: Record<FailureAction, string> = {
  retry: "Try again",
  change_photo: "Change reference photo",
  change_outfit: "Change the outfit",
  flat_lay: "Back to flat lay",
};

/**
 * An actionable failure is announced assertively; everything else stays polite.
 * Only the actions that can actually resolve this specific failure are shown.
 */
export function TryOnStatusNotice({
  errorCode,
  errorSummary,
  busy,
  ...handlers
}: TryOnStatusNoticeProps) {
  const copy = (errorCode && FAILURE_COPY[errorCode]) || DEFAULT_FAILURE;
  const handlerFor: Record<FailureAction, () => void> = {
    retry: handlers.onRetry,
    change_photo: handlers.onChangePhoto,
    change_outfit: handlers.onChangeOutfit,
    flat_lay: handlers.onBackToFlatLay,
  };

  return (
    <div aria-live="assertive" className="tryon-notice tryon-notice--error" role="alert">
      <p className="tryon-notice__title">{copy.title}</p>
      {errorSummary ? <p className="tryon-notice__detail">{errorSummary}</p> : null}
      <div className="tryon-notice__actions">
        {copy.actions.map((action) => (
          <Button
            className="button--small"
            disabled={busy}
            key={action}
            onClick={handlerFor[action]}
            variant={action === "retry" ? "primary" : "ghost"}
          >
            {ACTION_LABELS[action]}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Generation is always an explicit user action. Consent alone never starts one,
 * which is why this idle state exists rather than auto-generating on arrival.
 */
function TryOnIdle({
  notice,
  busy,
  onStart,
}: {
  notice: string | null;
  busy: boolean;
  onStart: () => void;
}) {
  return (
    <div className="tryon-empty">
      <p>See this exact outfit on you, generated privately.</p>
      {notice ? (
        <p aria-live="polite" className="tryon-empty__notice">
          {notice}
        </p>
      ) : null}
      <Button disabled={busy} onClick={onStart}>
        {busy ? "Starting…" : "Try it on"}
      </Button>
    </div>
  );
}

function TryOnBlockedByCutout() {
  return (
    <p className="inline-feedback">
      <span>
        One piece in this look has no cut-out photo yet, so it cannot be rendered. Re-import it
        through the photo flow to enable try-on.
      </span>
    </p>
  );
}

type TryOnStageProps = {
  variant: StudioVariant;
  visualization: StudioVisualization | null;
  notice: string | null;
  needsSetup: boolean;
  busy: boolean;
  selectedItemId: string | null;
  onStart: () => void;
  onRetry: () => void;
  onSelect: (itemId: string) => void;
  onBackToFlatLay: () => void;
};

/**
 * Maps the visualization state machine onto exactly one view. Every branch is
 * explicit: there is no state that renders a blank frame with a spinner and no
 * explanation.
 */
export function TryOnStage(props: TryOnStageProps) {
  const { variant, visualization, busy } = props;

  if (!variant.canVisualize) return <TryOnBlockedByCutout />;
  if (props.needsSetup) return <TryOnConsentGate onReady={props.onStart} />;
  if (!visualization) {
    return <TryOnIdle busy={busy} notice={props.notice} onStart={props.onStart} />;
  }

  if (visualization.inFlight) {
    return (
      <div aria-live="polite">
        <TryOnProgress status={visualization.status} />
      </div>
    );
  }

  if (visualization.status === "ready" || visualization.status === "stale") {
    return (
      <TryOnReady
        busy={busy}
        onRegenerate={props.onRetry}
        onSelect={props.onSelect}
        selectedItemId={props.selectedItemId}
        visualization={visualization}
      />
    );
  }

  return (
    <TryOnStatusNotice
      busy={busy}
      errorCode={visualization.errorCode}
      errorSummary={visualization.errorSummary}
      onBackToFlatLay={props.onBackToFlatLay}
      onChangeOutfit={props.onBackToFlatLay}
      onChangePhoto={props.onBackToFlatLay}
      onRetry={props.onRetry}
    />
  );
}

const MODES: { value: StudioMode; label: string; hint: string }[] = [
  { value: "flat-lay", label: "Flat lay", hint: "Your real pieces, instantly" },
  { value: "try-on", label: "AI try-on", hint: "Generated on request" },
];

/**
 * Switching modes never discards the selection, the locks, or an in-flight
 * generation — the studio state lives above this control.
 */
function StageModeTabs({
  mode,
  onSelect,
}: {
  mode: StudioMode;
  onSelect: (mode: StudioMode) => void;
}) {
  return (
    <div aria-label="View" className="stage-tabs" role="tablist">
      {MODES.map((entry) => {
        const selected = entry.value === mode;
        return (
          <button
            aria-selected={selected}
            className={`stage-tab${selected ? " stage-tab--on" : ""}`}
            key={entry.value}
            onClick={() => onSelect(entry.value)}
            role="tab"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="stage-tab__label">{entry.label}</span>
            <span className="stage-tab__hint">{entry.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** The centre column: mode tabs, the active stage, and the garment chips. */
export function StudioStage({ studio }: { studio: StudioState }) {
  const variant = studio.variants.selected;
  if (!variant) return null;

  const tryOnGarments = studio.tryOn.visualization?.garments ?? [];
  const chips =
    studio.stage === "try-on" && tryOnGarments.length > 0
      ? tryOnGarments
      : flatLayGarments(variant.items);

  return (
    <div className="studio-stage" id="studio-stage" role="tabpanel">
      <StageModeTabs mode={studio.stage} onSelect={studio.setStage} />

      {studio.stage === "flat-lay" ? (
        <FlatLayStage
          isLocked={studio.locks.isLocked}
          onSelect={studio.setSelectedItemId}
          onToggleLock={studio.locks.toggleLock}
          selectedItemId={studio.selectedItemId}
          variant={variant}
        />
      ) : (
        <TryOnStage
          busy={studio.tryOn.busy}
          needsSetup={studio.tryOn.needsSetup}
          notice={studio.tryOn.notice}
          onBackToFlatLay={() => studio.setStage("flat-lay")}
          onRetry={() => void studio.tryOn.retry()}
          onSelect={studio.setSelectedItemId}
          onStart={studio.startTryOn}
          selectedItemId={studio.selectedItemId}
          variant={variant}
          visualization={studio.tryOn.visualization}
        />
      )}

      <GarmentSelectorChips
        garments={chips}
        onSelect={studio.setSelectedItemId}
        selectedItemId={studio.selectedItemId}
      />
    </div>
  );
}

/**
 * Status transitions are announced politely; nothing here is an actionable
 * failure, so nothing here interrupts a screen reader.
 */
function StudioNotices({ studio }: { studio: StudioState }) {
  const { result, error, busy, variants } = studio.variants;

  return (
    <div aria-live="polite" className="studio-notices">
      {error ? (
        <p className="inline-feedback inline-feedback--error">
          <span>{error}</span>
        </p>
      ) : null}

      {busy ? <p className="studio-notices__status">Looking through your wardrobe…</p> : null}

      {result?.contextSummary ? (
        <p className="studio-notices__context">{result.contextSummary}</p>
      ) : null}

      {result?.shortfallReason ? (
        <p className="inline-feedback">
          <span>{result.shortfallReason}</span>
        </p>
      ) : null}

      {!busy && !result ? (
        <p className="studio-notices__empty">
          Describe where you are going — or press Surprise me — and you will get three complete
          looks built only from pieces you already own.
        </p>
      ) : null}

      {studio.actions.message ? (
        <p className="inline-feedback inline-feedback--success">
          <span>{studio.actions.message}</span>
        </p>
      ) : null}

      {variants.length > 0 && studio.locks.locked.length > 0 ? (
        <p className="studio-notices__locks">
          {studio.locks.locked.length} piece{studio.locks.locked.length === 1 ? "" : "s"} locked.
          Remix will keep {studio.locks.locked.length === 1 ? "it" : "them"} exactly.
        </p>
      ) : null}
    </div>
  );
}

function StudioActions({ studio, composerDate }: { studio: StudioState; composerDate: string }) {
  const variant = studio.variants.selected;
  if (!variant) return null;

  return (
    <OutfitActionDock
      busy={studio.actions.busy || studio.tryOn.busy}
      canVisualize={variant.canVisualize}
      hasLocks={studio.locks.locked.length > 0}
      mode={studio.stage}
      onPlan={() => void studio.actions.plan(composerDate)}
      onRemix={studio.remix}
      onSave={() => void studio.actions.save(variant)}
      onTryOn={studio.startTryOn}
      onWearToday={() => void studio.actions.wearToday()}
      saved={Boolean(studio.actions.savedOutfitId)}
    />
  );
}

/**
 * The single Outfit Studio experience, reached from outfit generation and
 * reusable for a saved, manual, or planned outfit. Twelve-column on desktop,
 * image-first with a sticky action dock on mobile — laid out in CSS so this
 * component stays one tree rather than two divergent renders.
 */
export function OutfitStudioShell({ initialDate }: { initialDate: string }) {
  const composer = useComposer(initialDate);
  const studio = useStudio(composer.occasion, composer.buildInput);

  return (
    <div className="studio">
      <aside className="studio__rail studio__rail--controls">
        <OutfitRequestComposer
          busy={studio.variants.busy}
          composer={composer}
          onSubmit={(surprise) => void studio.request(composer.buildInput(surprise))}
        />
        <RecommendationVariantTabs
          mode={studio.variants.mode}
          onSelect={studio.variants.setMode}
          variants={studio.variants.variants}
        />
      </aside>

      {/* A section, not a <main>: AppShell already owns the page's single
          main landmark, and nesting a second one is invalid. */}
      <section aria-label="Selected look" className="studio__main">
        <StudioNotices studio={studio} />
        <StudioStage studio={studio} />
        <StudioActions composerDate={composer.date} studio={studio} />
      </section>

      <aside className="studio__rail studio__rail--detail">
        <StudioDetailRail studio={studio} />
      </aside>
    </div>
  );
}
