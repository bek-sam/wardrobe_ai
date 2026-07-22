"use client";

import {
  ArrowClockwise,
  Camera,
  Check,
  Crop,
  ImageSquare,
  Plus,
  SpinnerGap,
  Sparkle,
  UploadSimple,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
} from "react";

import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";
import { createClient } from "@/lib/supabase/client";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

type JobStatus =
  | "queued"
  | "analyzing"
  | "review_crop"
  | "extracting"
  | "review_metadata"
  | "researching"
  | "complete"
  | "failed"
  | "cancelled";

type CandidateStatus =
  | "detected"
  | "review_crop"
  | "extracting"
  | "review_cutout"
  | "review_metadata"
  | "researching"
  | "approved"
  | "rejected"
  | "failed";

type BoundingBox = { x: number; y: number; width: number; height: number };

type CandidateMetadata = {
  name: string;
  category: string;
  subcategory: string | null;
  primary_color_hex: string | null;
  secondary_color_hex: string | null;
  color_names: string[];
  pattern: string | null;
  silhouette: string | null;
  materials: Record<string, unknown>;
  visible_text: string[];
  season_tags: string[];
  occasion_tags: string[];
  notes: string;
};

type CandidateView = {
  id: string;
  ordinal: number;
  status: CandidateStatus;
  boundingBox: BoundingBox;
  metadata: CandidateMetadata;
  fieldConfidence: Record<string, number>;
  cropUrl: string | null;
  cutoutUrl: string | null;
  failedCutoutUrl: string | null;
  modeledUrl: string | null;
  errorMessage: string | null;
  cleanupTolerance: number;
};

type ImportJobView = {
  id: string;
  status: JobStatus;
  progress: number;
  errorMessage: string | null;
  originalImageUrl: string | null;
  signedUrlExpiresIn: number;
  candidates: CandidateView[];
};

type SignedUpload = {
  bucket: string;
  path: string;
  token: string;
  requiredContentType: "image/jpeg" | "image/png" | "image/webp";
  maximumFileSize: number;
};

type MetadataForm = {
  name: string;
  category: string;
  subcategory: string;
  primaryColorHex: string;
  secondaryColorHex: string;
  colorNames: string;
  pattern: string;
  silhouette: string;
  material: string;
  visibleText: string;
  seasonTags: string;
  occasionTags: string;
  notes: string;
};

const jobStatuses = new Set<JobStatus>([
  "queued",
  "analyzing",
  "review_crop",
  "extracting",
  "review_metadata",
  "researching",
  "complete",
  "failed",
  "cancelled",
]);

const candidateStatuses = new Set<CandidateStatus>([
  "detected",
  "review_crop",
  "extracting",
  "review_cutout",
  "review_metadata",
  "researching",
  "approved",
  "rejected",
  "failed",
]);

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

const steps = [
  { number: "1", title: "Upload", copy: "Original stays private" },
  { number: "2", title: "Detect", copy: "Find each garment" },
  { number: "3", title: "Review", copy: "You correct every detail" },
  { number: "4", title: "Save", copy: "Add approved pieces only" },
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 50)
    : [];
}

function safeSignedUrl(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function safeInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isInteger(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function normalizeMetadata(proposed: unknown, confirmed: unknown): CandidateMetadata {
  const first = isObject(proposed) ? proposed : {};
  const second = isObject(confirmed) ? confirmed : {};
  const merged = { ...first, ...second };
  return {
    name: stringValue(merged.name, "Untitled garment"),
    category: stringValue(merged.category, "other"),
    subcategory: nullableString(merged.subcategory),
    primary_color_hex: safeColor(merged.primary_color_hex),
    secondary_color_hex: safeColor(merged.secondary_color_hex),
    color_names: stringList(merged.color_names),
    pattern: nullableString(merged.pattern),
    silhouette: nullableString(merged.silhouette),
    materials: isObject(merged.materials) ? merged.materials : {},
    visible_text: stringList(merged.visible_text),
    season_tags: stringList(merged.season_tags),
    occasion_tags: stringList(merged.occasion_tags),
    notes: stringValue(merged.notes),
  };
}

function normalizeBoundingBox(value: unknown): BoundingBox {
  const box = isObject(value) ? value : {};
  return {
    x: safeInteger(box.x, 0, 0, 999),
    y: safeInteger(box.y, 0, 0, 999),
    width: safeInteger(box.width, 1000, 1, 1000),
    height: safeInteger(box.height, 1000, 1, 1000),
  };
}

function normalizeCandidate(value: unknown, index: number): CandidateView | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  const status = candidateStatuses.has(value.status as CandidateStatus)
    ? (value.status as CandidateStatus)
    : "failed";
  const confidence = isObject(value.field_confidence)
    ? Object.fromEntries(
        Object.entries(value.field_confidence).filter(
          (entry): entry is [string, number] =>
            typeof entry[1] === "number" && entry[1] >= 0 && entry[1] <= 1,
        ),
      )
    : {};
  return {
    id: value.id,
    ordinal: safeInteger(value.ordinal, index, 0, 99),
    status,
    boundingBox: normalizeBoundingBox(value.bounding_box),
    metadata: normalizeMetadata(value.proposed_metadata, value.confirmed_metadata),
    fieldConfidence: confidence,
    cropUrl: safeSignedUrl(value.cropUrl),
    cutoutUrl: safeSignedUrl(value.cutoutUrl),
    failedCutoutUrl: safeSignedUrl(value.failedCutoutUrl),
    modeledUrl: safeSignedUrl(value.modeledUrl),
    errorMessage: nullableString(value.error_message),
    cleanupTolerance: safeInteger(value.cleanup_tolerance, 46, 18, 110),
  };
}

function normalizeJob(value: unknown): ImportJobView | null {
  if (!isObject(value) || typeof value.id !== "string") return null;
  const status = jobStatuses.has(value.status as JobStatus)
    ? (value.status as JobStatus)
    : "failed";
  const candidates = Array.isArray(value.import_job_candidates)
    ? value.import_job_candidates
        .map(normalizeCandidate)
        .filter((candidate): candidate is CandidateView => candidate !== null)
        .sort((a, b) => a.ordinal - b.ordinal)
    : [];
  return {
    id: value.id,
    status,
    progress: safeInteger(value.progress, 0, 0, 100),
    errorMessage: nullableString(value.error_message),
    originalImageUrl: safeSignedUrl(value.originalImageUrl),
    signedUrlExpiresIn: safeInteger(value.signedUrlExpiresIn, 600, 60, 7200),
    candidates,
  };
}

function errorMessage(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
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
// compilation job whenever confirmed items land, so this call is purely a
// latency optimization to process it promptly. Safe to ignore if it fails.
function triggerWardrobeCompile() {
  fetch("/api/wardrobe/compile", { method: "POST" }).catch(() => {});
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function csv(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function materialName(materials: Record<string, unknown>) {
  if (typeof materials.apparent === "string") return materials.apparent;
  const match = Object.values(materials).find((value) => typeof value === "string");
  return typeof match === "string" ? match : "";
}

function formFromMetadata(metadata: CandidateMetadata): MetadataForm {
  return {
    name: metadata.name,
    category: metadata.category,
    subcategory: metadata.subcategory ?? "",
    primaryColorHex: metadata.primary_color_hex ?? "",
    secondaryColorHex: metadata.secondary_color_hex ?? "",
    colorNames: metadata.color_names.join(", "),
    pattern: metadata.pattern ?? "",
    silhouette: metadata.silhouette ?? "",
    material: materialName(metadata.materials),
    visibleText: metadata.visible_text.join(", "),
    seasonTags: metadata.season_tags.join(", "),
    occasionTags: metadata.occasion_tags.join(", "),
    notes: metadata.notes,
  };
}

function metadataFromForm(form: MetadataForm): CandidateMetadata {
  return {
    name: form.name.trim(),
    category: form.category,
    subcategory: form.subcategory.trim() || null,
    primary_color_hex: form.primaryColorHex || null,
    secondary_color_hex: form.secondaryColorHex || null,
    color_names: csv(form.colorNames).slice(0, 8),
    pattern: form.pattern.trim() || null,
    silhouette: form.silhouette.trim() || null,
    materials: form.material.trim() ? { apparent: form.material.trim(), inferred: true } : {},
    visible_text: csv(form.visibleText).slice(0, 12),
    season_tags: csv(form.seasonTags).slice(0, 8),
    occasion_tags: csv(form.occasionTags).slice(0, 12),
    notes: form.notes.trim(),
  };
}

function confidenceLabel(confidence: Record<string, number>) {
  const values = Object.values(confidence);
  if (!values.length) return { label: "Needs your review", tone: "outline" as const };
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (average >= 0.8) return { label: "High confidence", tone: "sage" as const };
  if (average >= 0.55) return { label: "Medium confidence", tone: "gold" as const };
  return { label: "Low confidence", tone: "rust" as const };
}

function PreviewImport() {
  return (
    <>
      <DemoNotice>
        This is an explicitly labeled workflow preview because Supabase is not configured. Connect
        Supabase to upload private images and create resumable import jobs.
      </DemoNotice>
      <ImportSteps current={1} />
      <section className="upload-zone" aria-labelledby="preview-upload-title">
        <div className="upload-zone__icon">
          <UploadSimple size={31} weight="light" />
        </div>
        <h2 id="preview-upload-title">Drop clothing photos here</h2>
        <p>JPG, PNG, or WebP up to 20 MB. Upload is disabled in preview mode.</p>
        <div>
          <Button disabled>
            <ImageSquare size={16} /> Choose photo
          </Button>
          <Button disabled variant="secondary">
            <Camera size={16} /> Use camera
          </Button>
        </div>
      </section>
      <section className="candidate-section" aria-labelledby="preview-candidate-title">
        <div className="card-title-row">
          <div>
            <p className="eyebrow">Workflow preview</p>
            <h2 id="preview-candidate-title">2 sample garments</h2>
          </div>
          <Badge tone="outline">Sample candidates</Badge>
        </div>
        <div className="candidate-grid">
          {[
            { name: "Stone Oxford Shirt", category: "top" as const, color: "#ddd4c2" },
            { name: "Navy Trouser", category: "bottom" as const, color: "#293647" },
          ].map((item) => (
            <Card as="article" className="candidate-card" key={item.name} padded={false}>
              <div className="candidate-card__image">
                <GarmentArtwork category={item.category} color={item.color} />
                <span>
                  <Crop size={14} /> Sample crop
                </span>
              </div>
              <div className="candidate-card__body">
                <div>
                  <Badge tone="outline">Preview only</Badge>
                  <h3>{item.name}</h3>
                  <p>Nothing from this card is saved.</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}

function ImportSteps({ current }: { current: number }) {
  return (
    <ol className="import-steps">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const complete = stepNumber < current;
        return (
          <li
            className={complete ? "is-complete" : stepNumber === current ? "is-active" : ""}
            key={step.number}
          >
            <span>{complete ? <Check size={13} weight="bold" /> : step.number}</span>
            <div>
              <strong>{step.title}</strong>
              <small>{step.copy}</small>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function CandidateImage({ candidate }: { candidate: CandidateView }) {
  const url =
    candidate.status === "review_crop" || candidate.status === "extracting"
      ? candidate.cropUrl
      : (candidate.cutoutUrl ?? candidate.cropUrl ?? candidate.failedCutoutUrl);
  return (
    <div className="candidate-card__image candidate-card__image--photo">
      {url ? (
        // Signed private URLs are intentionally rendered without Next's public image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={`${candidate.metadata.name} review`} src={url} />
      ) : (
        <GarmentArtwork
          category={candidate.metadata.category === "bottoms" ? "bottom" : "top"}
          color={candidate.metadata.primary_color_hex ?? "#a49b8e"}
        />
      )}
      <span>
        {candidate.status === "review_crop" ? <Crop size={14} /> : <Sparkle size={14} />}
        {titleCase(candidate.status)}
      </span>
    </div>
  );
}

function CropReview({
  candidate,
  busy,
  onApprove,
}: {
  candidate: CandidateView;
  busy: boolean;
  onApprove: (box: BoundingBox) => Promise<void>;
}) {
  const [box, setBox] = useState(candidate.boundingBox);
  return (
    <form
      className="candidate-review-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onApprove(box);
      }}
    >
      <p className="candidate-review-copy">
        Check that the whole garment is visible. Coordinates use a 0–1000 image scale.
      </p>
      <div className="crop-field-grid">
        {(Object.keys(box) as Array<keyof BoundingBox>).map((key) => (
          <label key={key}>
            <span>{titleCase(key)}</span>
            <input
              className="text-input"
              max={key === "x" || key === "y" ? 999 : 1000}
              min={key === "x" || key === "y" ? 0 : 1}
              onChange={(event) =>
                setBox((current) => ({ ...current, [key]: Number(event.target.value) }))
              }
              required
              type="number"
              value={box[key]}
            />
          </label>
        ))}
      </div>
      <Button disabled={busy} type="submit">
        {busy ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
        Approve crop &amp; extract
      </Button>
    </form>
  );
}

function CutoutReview({
  candidate,
  busy,
  onApprove,
  onRegenerate,
}: {
  candidate: CandidateView;
  busy: boolean;
  onApprove: () => Promise<void>;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [tolerance, setTolerance] = useState(candidate.cleanupTolerance);
  return (
    <div className="candidate-review-form">
      <p className="candidate-review-copy">
        Approve when the full garment and its color look right, or describe what the next cutout
        should fix.
      </p>
      {candidate.errorMessage ? (
        <p className="inline-feedback inline-feedback--error">
          <WarningCircle size={15} /> {candidate.errorMessage}
        </p>
      ) : null}
      {candidate.status !== "failed" ? (
        <Button disabled={busy} onClick={() => void onApprove()}>
          <Check size={15} /> Approve cutout
        </Button>
      ) : null}
      <details className="regenerate-panel" open={candidate.status === "failed"}>
        <summary>Regenerate cutout</summary>
        <label className="form-field">
          <span>What should change?</span>
          <textarea
            className="textarea-input"
            maxLength={1200}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="Keep the full left sleeve and preserve the navy color."
            value={instruction}
          />
        </label>
        <label className="tolerance-control">
          <span>Background cleanup: {tolerance}</span>
          <input
            max={110}
            min={18}
            onChange={(event) => setTolerance(Number(event.target.value))}
            type="range"
            value={tolerance}
          />
        </label>
        <Button
          disabled={busy}
          onClick={() => void onRegenerate(instruction, tolerance)}
          variant="secondary"
        >
          <ArrowClockwise size={15} /> Regenerate
        </Button>
      </details>
    </div>
  );
}

function MetadataReview({
  candidate,
  busy,
  onDirty,
  onSave,
  onRegenerate,
}: {
  candidate: CandidateView;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onSave: (metadata: CandidateMetadata) => Promise<boolean>;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
}) {
  const [form, setForm] = useState(() => formFromMetadata(candidate.metadata));
  const [regenerationOpen, setRegenerationOpen] = useState(false);
  const confidence = confidenceLabel(candidate.fieldConfidence);

  function setField<Key extends keyof MetadataForm>(key: Key, value: MetadataForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    onDirty(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(metadataFromForm(form));
    if (saved) onDirty(false);
  }

  return (
    <form className="metadata-review-form" onSubmit={(event) => void submit(event)}>
      <Badge tone={confidence.tone}>{confidence.label}</Badge>
      {Object.keys(candidate.fieldConfidence).length ? (
        <div className="field-confidence-list" aria-label="AI confidence by field">
          {Object.entries(candidate.fieldConfidence).map(([field, value]) => (
            <span key={field}>
              {titleCase(field)} <strong>{Math.round(value * 100)}%</strong>
            </span>
          ))}
        </div>
      ) : null}
      <div className="form-grid form-grid--two">
        <label className="form-field">
          <span>Name</span>
          <input
            className="text-input"
            maxLength={160}
            onChange={(event) => setField("name", event.target.value)}
            required
            value={form.name}
          />
        </label>
        <label className="form-field">
          <span>Category</span>
          <select
            className="select-input"
            onChange={(event) => setField("category", event.target.value)}
            value={form.category}
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {titleCase(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          <span>Subcategory</span>
          <input
            className="text-input"
            maxLength={80}
            onChange={(event) => setField("subcategory", event.target.value)}
            value={form.subcategory}
          />
        </label>
        <label className="form-field">
          <span>Color names</span>
          <input
            className="text-input"
            onChange={(event) => setField("colorNames", event.target.value)}
            placeholder="navy, cream"
            value={form.colorNames}
          />
        </label>
        <div className="form-field">
          <span>Primary color</span>
          <div className="optional-color-row">
            <input
              aria-label="Primary garment color"
              disabled={!form.primaryColorHex}
              onChange={(event) => setField("primaryColorHex", event.target.value)}
              type="color"
              value={form.primaryColorHex || "#8b7d6b"}
            />
            <label className="check-row">
              <input
                checked={Boolean(form.primaryColorHex)}
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
          <span>Secondary color</span>
          <div className="optional-color-row">
            <input
              aria-label="Secondary garment color"
              disabled={!form.secondaryColorHex}
              onChange={(event) => setField("secondaryColorHex", event.target.value)}
              type="color"
              value={form.secondaryColorHex || "#d6d0c5"}
            />
            <label className="check-row">
              <input
                checked={Boolean(form.secondaryColorHex)}
                onChange={(event) =>
                  setField("secondaryColorHex", event.target.checked ? "#d6d0c5" : "")
                }
                type="checkbox"
              />
              Include
            </label>
          </div>
        </div>
        <label className="form-field">
          <span>Pattern</span>
          <input
            className="text-input"
            maxLength={80}
            onChange={(event) => setField("pattern", event.target.value)}
            value={form.pattern}
          />
        </label>
        <label className="form-field">
          <span>Silhouette</span>
          <input
            className="text-input"
            maxLength={80}
            onChange={(event) => setField("silhouette", event.target.value)}
            value={form.silhouette}
          />
        </label>
        <label className="form-field">
          <span>Apparent material</span>
          <input
            className="text-input"
            maxLength={80}
            onChange={(event) => setField("material", event.target.value)}
            value={form.material}
          />
          <small className="form-field__hint">
            Visible material is an inference, not a verified fact.
          </small>
        </label>
        <label className="form-field">
          <span>Visible text</span>
          <input
            className="text-input"
            onChange={(event) => setField("visibleText", event.target.value)}
            placeholder="Comma separated"
            value={form.visibleText}
          />
        </label>
        <label className="form-field">
          <span>Seasons</span>
          <input
            className="text-input"
            onChange={(event) => setField("seasonTags", event.target.value)}
            placeholder="spring, fall"
            value={form.seasonTags}
          />
        </label>
        <label className="form-field">
          <span>Occasions</span>
          <input
            className="text-input"
            onChange={(event) => setField("occasionTags", event.target.value)}
            placeholder="work, casual"
            value={form.occasionTags}
          />
        </label>
      </div>
      <label className="form-field">
        <span>Notes</span>
        <textarea
          className="textarea-input"
          maxLength={2000}
          onChange={(event) => setField("notes", event.target.value)}
          value={form.notes}
        />
      </label>
      <div className="metadata-review-form__actions">
        <Button disabled={busy || !form.name.trim()} type="submit">
          {busy ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
          Save reviewed details
        </Button>
        <Button onClick={() => setRegenerationOpen((open) => !open)} type="button" variant="ghost">
          <ArrowClockwise size={15} /> Improve cutout
        </Button>
      </div>
      {regenerationOpen ? (
        <div className="metadata-regenerate">
          <p>Regeneration keeps your saved metadata separate until you review the new cutout.</p>
          <Button
            disabled={busy}
            onClick={() =>
              void onRegenerate(
                "Preserve the complete garment and its visible colors.",
                candidate.cleanupTolerance,
              )
            }
            type="button"
            variant="secondary"
          >
            Regenerate cutout
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function CandidateCard({
  candidate,
  busy,
  onDirty,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
}: {
  candidate: CandidateView;
  busy: boolean;
  onDirty: (dirty: boolean) => void;
  onApproveCrop: (box: BoundingBox) => Promise<void>;
  onApproveCutout: () => Promise<void>;
  onReject: () => Promise<void>;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
  onSaveMetadata: (metadata: CandidateMetadata) => Promise<boolean>;
}) {
  const confidence = confidenceLabel(candidate.fieldConfidence);
  return (
    <Card as="article" className="candidate-card candidate-card--live" padded={false}>
      <CandidateImage candidate={candidate} />
      <div className="candidate-card__body">
        <div className="candidate-card__summary">
          <Badge tone={confidence.tone}>{confidence.label}</Badge>
          <h3>{candidate.metadata.name}</h3>
          <p>
            {titleCase(candidate.metadata.category)}
            {candidate.metadata.color_names.length
              ? ` · ${candidate.metadata.color_names.join(", ")}`
              : " · color needs review"}
          </p>
        </div>
        {candidate.status === "review_crop" ? (
          <CropReview busy={busy} candidate={candidate} onApprove={onApproveCrop} />
        ) : null}
        {candidate.status === "review_cutout" || candidate.status === "failed" ? (
          <CutoutReview
            busy={busy}
            candidate={candidate}
            onApprove={onApproveCutout}
            onRegenerate={onRegenerate}
          />
        ) : null}
        {candidate.status === "review_metadata" ? (
          <MetadataReview
            busy={busy}
            candidate={candidate}
            onDirty={onDirty}
            onRegenerate={onRegenerate}
            onSave={onSaveMetadata}
          />
        ) : null}
        {["detected", "extracting", "researching"].includes(candidate.status) ? (
          <div className="candidate-processing" aria-live="polite">
            <SpinnerGap className="spin" size={18} />
            <span>
              {candidate.status === "extracting"
                ? "Creating a clean private cutout…"
                : "Processing this garment…"}
            </span>
          </div>
        ) : null}
        {candidate.status === "approved" ? (
          <p className="inline-feedback inline-feedback--success">
            <Check size={16} /> Saved to your wardrobe
          </p>
        ) : null}
        {candidate.status === "rejected" ? (
          <p className="inline-feedback">
            <X size={16} /> Skipped — this garment will not be saved
          </p>
        ) : null}
        {["review_crop", "review_cutout", "review_metadata", "failed"].includes(
          candidate.status,
        ) ? (
          <Button disabled={busy} onClick={() => void onReject()} type="button" variant="ghost">
            <X size={15} /> Skip this garment
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function ImportWorkspace({ configured }: { configured: boolean }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const localPreviewRef = useRef<string | null>(null);
  const processingJobs = useRef(new Set<string>());
  const uploadLock = useRef(false);
  const [job, setJob] = useState<ImportJobView | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [userHint, setUserHint] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(configured);
  const [uploadStage, setUploadStage] = useState<
    "idle" | "signing" | "uploading" | "creating" | "processing"
  >("idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirtyCandidates, setDirtyCandidates] = useState<Set<string>>(new Set());

  const clearLocalPreview = useCallback(() => {
    if (localPreviewRef.current) URL.revokeObjectURL(localPreviewRef.current);
    localPreviewRef.current = null;
    setLocalPreviewUrl(null);
  }, []);

  useEffect(() => clearLocalPreview, [clearLocalPreview]);

  const refreshJob = useCallback(async (jobId: string) => {
    const raw = await requestJson<unknown>(`/api/imports/${encodeURIComponent(jobId)}`);
    const next = normalizeJob(raw);
    if (!next) throw new Error("The import job response was not valid.");
    setJob(next);
    return next;
  }, []);

  const startProcessing = useCallback(
    (jobId: string) => {
      if (processingJobs.current.has(jobId)) return;
      processingJobs.current.add(jobId);
      setUploadStage("processing");
      void requestJson<unknown>(`/api/imports/${encodeURIComponent(jobId)}/process`, {
        method: "POST",
      })
        .then(() => refreshJob(jobId))
        .catch((caught: unknown) => {
          setError(
            caught instanceof Error
              ? caught.message
              : "Processing paused. Your import is saved and can be retried.",
          );
        })
        .finally(() => {
          processingJobs.current.delete(jobId);
          setUploadStage("idle");
        });
    },
    [refreshJob],
  );

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    void requestJson<unknown[]>("/api/imports")
      .then((rawJobs) => {
        if (cancelled) return;
        const jobs = rawJobs
          .map(normalizeJob)
          .filter((entry): entry is ImportJobView => entry !== null);
        const resumable = jobs.find((entry) => !["complete", "cancelled"].includes(entry.status));
        if (resumable) {
          setJob(resumable);
          if (
            ["queued", "analyzing", "extracting"].includes(resumable.status) ||
            resumable.candidates.some((candidate) => candidate.status === "extracting")
          ) {
            startProcessing(resumable.id);
          }
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error ? caught.message : "Existing imports could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingExisting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [configured, startProcessing]);

  useEffect(() => {
    if (!job || ["complete", "cancelled"].includes(job.status)) return;
    const activelyProcessing =
      ["queued", "analyzing", "extracting", "researching"].includes(job.status) ||
      job.candidates.some((candidate) => candidate.status === "extracting");
    const interval = window.setInterval(
      () => {
        void refreshJob(job.id).catch((caught: unknown) => {
          setError(
            caught instanceof Error ? caught.message : "Import progress could not be refreshed.",
          );
        });
      },
      activelyProcessing ? 1800 : Math.min(240_000, Math.max(60_000, job.signedUrlExpiresIn * 500)),
    );
    return () => window.clearInterval(interval);
  }, [job, refreshJob]);

  useEffect(() => {
    if (job?.originalImageUrl && localPreviewRef.current) clearLocalPreview();
  }, [clearLocalPreview, job?.originalImageUrl]);

  const processFile = useCallback(
    async (file: File) => {
      if (
        !configured ||
        loadingExisting ||
        job ||
        uploadStage !== "idle" ||
        busyAction ||
        uploadLock.current
      ) {
        return;
      }
      uploadLock.current = true;
      setError(null);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Choose a JPG, PNG, or WebP image.");
        uploadLock.current = false;
        return;
      }
      if (!file.size || file.size > 20 * 1024 * 1024) {
        setError("Choose an image smaller than 20 MB.");
        uploadLock.current = false;
        return;
      }
      clearLocalPreview();
      const objectUrl = URL.createObjectURL(file);
      localPreviewRef.current = objectUrl;
      setLocalPreviewUrl(objectUrl);
      setDirtyCandidates(new Set());
      setJob(null);
      try {
        setUploadStage("signing");
        const signed = await requestJson<SignedUpload>("/api/uploads/sign", {
          method: "POST",
          body: JSON.stringify({
            purpose: "wardrobe-original",
            fileName: file.name || "camera-photo.jpg",
            contentType: file.type,
            fileSize: file.size,
          }),
        });
        if (file.size > signed.maximumFileSize || signed.requiredContentType !== file.type) {
          throw new Error("The selected file does not match the signed upload requirements.");
        }
        setUploadStage("uploading");
        const supabase = createClient();
        const { error: uploadError } = await supabase.storage
          .from(signed.bucket)
          .uploadToSignedUrl(signed.path, signed.token, file, {
            contentType: signed.requiredContentType,
          });
        if (uploadError) throw new Error("The private image upload failed. Please try again.");

        setUploadStage("creating");
        const idempotencyKey = crypto.randomUUID();
        const rawJob = await requestJson<unknown>("/api/imports", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey },
          body: JSON.stringify({
            originalImagePath: signed.path,
            userHint: userHint.trim() || null,
            idempotencyKey,
          }),
        });
        const created = normalizeJob(rawJob);
        if (!created) throw new Error("The import job response was not valid.");
        setJob(created);
        startProcessing(created.id);
      } catch (caught) {
        setUploadStage("idle");
        setError(caught instanceof Error ? caught.message : "The image could not be uploaded.");
      } finally {
        uploadLock.current = false;
      }
    },
    [
      busyAction,
      clearLocalPreview,
      configured,
      job,
      loadingExisting,
      startProcessing,
      uploadStage,
      userHint,
    ],
  );

  useEffect(() => {
    if (!configured) return;
    function paste(event: ClipboardEvent) {
      const file = Array.from(event.clipboardData?.files ?? []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (file) void processFile(file);
    }
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [configured, processFile]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void processFile(file);
  }

  async function candidateAction(
    candidate: CandidateView,
    action: () => Promise<unknown>,
    processAfter = false,
  ) {
    if (!job) return false;
    setBusyAction(candidate.id);
    setError(null);
    try {
      await action();
      const refreshed = await refreshJob(job.id);
      if (processAfter) startProcessing(refreshed.id);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review action could not be saved.");
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  async function approveCrop(candidate: CandidateView, boundingBox: BoundingBox) {
    if (!job) return;
    await candidateAction(
      candidate,
      async () => {
        const root = `/api/imports/${encodeURIComponent(job.id)}/items/${encodeURIComponent(candidate.id)}`;
        await requestJson<unknown>(root, {
          method: "PATCH",
          body: JSON.stringify({ boundingBox }),
        });
        await requestJson<unknown>(`${root}/approve-crop`, { method: "POST" });
      },
      true,
    );
  }

  async function approveCutout(candidate: CandidateView) {
    if (!job) return;
    await candidateAction(candidate, () =>
      requestJson<unknown>(
        `/api/imports/${encodeURIComponent(job.id)}/items/${encodeURIComponent(candidate.id)}/approve-cutout`,
        { method: "POST" },
      ),
    );
  }

  async function regenerate(candidate: CandidateView, instruction: string, tolerance: number) {
    if (!job) return;
    await candidateAction(
      candidate,
      () =>
        requestJson<unknown>(
          `/api/imports/${encodeURIComponent(job.id)}/items/${encodeURIComponent(candidate.id)}/regenerate-cutout`,
          {
            method: "POST",
            body: JSON.stringify({
              instruction: instruction.trim() || null,
              cleanupTolerance: tolerance,
            }),
          },
        ),
      true,
    );
  }

  async function saveMetadata(candidate: CandidateView, metadata: CandidateMetadata) {
    if (!job) return false;
    return candidateAction(candidate, () =>
      requestJson<unknown>(
        `/api/imports/${encodeURIComponent(job.id)}/items/${encodeURIComponent(candidate.id)}`,
        { method: "PATCH", body: JSON.stringify({ metadata }) },
      ),
    );
  }

  async function rejectCandidate(candidate: CandidateView) {
    if (!job || !window.confirm(`Skip ${candidate.metadata.name}? It will not be saved.`)) {
      return;
    }
    const rejected = await candidateAction(candidate, () =>
      requestJson<unknown>(
        `/api/imports/${encodeURIComponent(job.id)}/items/${encodeURIComponent(candidate.id)}`,
        { method: "DELETE" },
      ),
    );
    if (rejected) {
      setDirtyCandidates((current) => {
        const next = new Set(current);
        next.delete(candidate.id);
        return next;
      });
    }
  }

  async function confirmImport() {
    if (!job) return;
    setBusyAction("confirm");
    setError(null);
    try {
      await requestJson<unknown>(`/api/imports/${encodeURIComponent(job.id)}/confirm`, {
        method: "POST",
      });
      triggerWardrobeCompile();
      await refreshJob(job.id);
      setDirtyCandidates(new Set());
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The reviewed garments could not be saved.",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function cancelImport() {
    if (!job) return;
    if (!window.confirm("Cancel this import? No garments from it will be saved.")) {
      return;
    }
    setBusyAction("cancel");
    setError(null);
    try {
      const response = await fetch(`/api/imports/${encodeURIComponent(job.id)}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(errorMessage(payload, "The import could not be cancelled."));
      }
      setJob((current) => (current ? { ...current, status: "cancelled" } : null));
      clearLocalPreview();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import could not be cancelled.");
    } finally {
      setBusyAction(null);
    }
  }

  const currentStep = useMemo(() => {
    if (!job) return 1;
    if (["queued", "analyzing"].includes(job.status)) return 2;
    if (job.status === "complete") return 4;
    return 3;
  }, [job]);

  const canConfirm = Boolean(
    job &&
    job.status === "review_metadata" &&
    job.candidates.length > 0 &&
    job.candidates.every((candidate) =>
      ["review_metadata", "approved", "rejected"].includes(candidate.status),
    ) &&
    job.candidates.some((candidate) =>
      ["review_metadata", "approved"].includes(candidate.status),
    ) &&
    dirtyCandidates.size === 0 &&
    !busyAction,
  );

  const activeProcessing = Boolean(
    job &&
    (["queued", "analyzing", "extracting", "researching"].includes(job.status) ||
      job.candidates.some((candidate) => candidate.status === "extracting")),
  );

  return (
    <div className="page-stack import-page">
      <PageHeader
        eyebrow="Add clothes"
        title="Import by photo"
        description="One garment or a full outfit works. Nothing is saved until you approve it."
        actions={
          job && !["complete", "cancelled"].includes(job.status) ? (
            <Button
              disabled={busyAction === "cancel"}
              onClick={() => void cancelImport()}
              variant="ghost"
            >
              <X size={15} /> Cancel import
            </Button>
          ) : undefined
        }
      />
      {!configured ? <PreviewImport /> : null}
      {configured ? (
        <>
          <ImportSteps current={currentStep} />
          {error ? (
            <div className="inline-feedback inline-feedback--error" role="alert">
              <WarningCircle size={17} />
              <span>{error}</span>
              {job &&
              (["queued", "analyzing", "extracting", "failed"].includes(job.status) ||
                job.candidates.some((candidate) => candidate.status === "extracting")) ? (
                <Button onClick={() => startProcessing(job.id)} variant="ghost">
                  Resume processing
                </Button>
              ) : null}
            </div>
          ) : null}
          {loadingExisting ? (
            <Card className="import-loading" role="status">
              <SpinnerGap className="spin" size={21} /> Checking for an unfinished import…
            </Card>
          ) : null}
          {!loadingExisting && !job ? (
            <>
              <label className="form-field import-hint-field">
                <span>Optional note for detection</span>
                <input
                  className="text-input"
                  maxLength={500}
                  onChange={(event) => setUserHint(event.target.value)}
                  placeholder="Example: the scarf belongs to this outfit too"
                  value={userHint}
                />
              </label>
              <section
                aria-labelledby="upload-title"
                className={`upload-zone${dragging ? " is-dragging" : ""}`}
                onDragEnter={(event: DragEvent<HTMLElement>) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={(event: DragEvent<HTMLElement>) => {
                  event.preventDefault();
                  if (event.currentTarget === event.target) setDragging(false);
                }}
                onDragOver={(event: DragEvent<HTMLElement>) => event.preventDefault()}
                onDrop={(event: DragEvent<HTMLElement>) => {
                  event.preventDefault();
                  setDragging(false);
                  const file = Array.from(event.dataTransfer.files).find((entry) =>
                    entry.type.startsWith("image/"),
                  );
                  if (file) void processFile(file);
                }}
              >
                <div className="upload-zone__icon">
                  {uploadStage === "idle" ? (
                    <UploadSimple size={31} weight="light" />
                  ) : (
                    <SpinnerGap className="spin" size={31} weight="light" />
                  )}
                </div>
                <h2 id="upload-title">
                  {uploadStage === "idle" ? "Drop a clothing photo here" : titleCase(uploadStage)}
                </h2>
                <p>Choose JPG, PNG, or WebP. Use a clear image under 20 MB for the best result.</p>
                <div>
                  <Button
                    disabled={uploadStage !== "idle"}
                    onClick={() => fileInput.current?.click()}
                  >
                    <ImageSquare size={16} /> Choose photo
                  </Button>
                  <Button
                    disabled={uploadStage !== "idle"}
                    onClick={() => cameraInput.current?.click()}
                    variant="secondary"
                  >
                    <Camera size={16} /> Use camera
                  </Button>
                </div>
                <small>Or paste an image from your clipboard</small>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={selectFile}
                  ref={fileInput}
                  type="file"
                />
                <input
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  onChange={selectFile}
                  ref={cameraInput}
                  type="file"
                />
              </section>
              {localPreviewUrl ? (
                <div className="local-upload-preview" aria-live="polite">
                  {/* Blob URLs are local-only previews and are revoked after signing or unmount. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Selected upload preview" src={localPreviewUrl} />
                  <span>{titleCase(uploadStage)}</span>
                </div>
              ) : null}
            </>
          ) : null}
          {job ? (
            <>
              <Card className="import-progress-card">
                <div className="import-progress-card__copy">
                  <div>
                    <p className="eyebrow">Private import</p>
                    <h2>{job.status === "complete" ? "Garments saved" : titleCase(job.status)}</h2>
                  </div>
                  <strong>{job.progress}%</strong>
                </div>
                <div
                  aria-label={`Import progress: ${job.progress}%`}
                  aria-valuemax={100}
                  aria-valuemin={0}
                  aria-valuenow={job.progress}
                  className="import-progress-track"
                  role="progressbar"
                >
                  <span style={{ width: `${job.progress}%` }} />
                </div>
                {activeProcessing || uploadStage === "processing" ? (
                  <p className="import-progress-card__status" role="status">
                    <SpinnerGap className="spin" size={16} /> AI processing may take a few minutes.
                    You can return to this page without losing the job.
                  </p>
                ) : null}
                {job.errorMessage ? (
                  <p className="inline-feedback inline-feedback--error">
                    <WarningCircle size={16} /> {job.errorMessage}
                  </p>
                ) : null}
              </Card>
              {job.originalImageUrl ? (
                <details className="original-image-review">
                  <summary>View private original</summary>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="Original import" src={job.originalImageUrl} />
                </details>
              ) : null}
              {job.candidates.length ? (
                <section className="candidate-section" aria-labelledby="candidate-title">
                  <div className="card-title-row">
                    <div>
                      <p className="eyebrow">Review required</p>
                      <h2 id="candidate-title">
                        {job.candidates.length}{" "}
                        {job.candidates.length === 1 ? "garment" : "garments"} detected
                      </h2>
                    </div>
                    <Badge tone="outline">Nothing saves without confirmation</Badge>
                  </div>
                  <div className="candidate-grid candidate-grid--review">
                    {job.candidates.map((candidate) => (
                      <CandidateCard
                        busy={busyAction === candidate.id}
                        candidate={candidate}
                        key={candidate.id}
                        onApproveCrop={(box) => approveCrop(candidate, box)}
                        onApproveCutout={() => approveCutout(candidate)}
                        onReject={() => rejectCandidate(candidate)}
                        onDirty={(dirty) =>
                          setDirtyCandidates((current) => {
                            const next = new Set(current);
                            if (dirty) next.add(candidate.id);
                            else next.delete(candidate.id);
                            return next;
                          })
                        }
                        onRegenerate={(instruction, tolerance) =>
                          regenerate(candidate, instruction, tolerance)
                        }
                        onSaveMetadata={(metadata) => saveMetadata(candidate, metadata)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
              {job.status === "review_metadata" ? (
                <Card className="confirm-import-card">
                  <div>
                    <p className="eyebrow">Final check</p>
                    <h2>Add reviewed garments to your wardrobe</h2>
                    <p>
                      Save any edited detail cards first. Only these detected, approved pieces will
                      be created.
                    </p>
                    {dirtyCandidates.size ? (
                      <small>{dirtyCandidates.size} card has unsaved changes.</small>
                    ) : null}
                  </div>
                  <Button disabled={!canConfirm} onClick={() => void confirmImport()}>
                    {busyAction === "confirm" ? (
                      <SpinnerGap className="spin" size={16} />
                    ) : (
                      <Check size={16} />
                    )}
                    Confirm &amp; save
                  </Button>
                </Card>
              ) : null}
              {job.status === "complete" ? (
                <Card className="import-complete-card">
                  <span>
                    <Check size={24} weight="bold" />
                  </span>
                  <div>
                    <h2>Your reviewed pieces are in Wardrobe</h2>
                    <p>The original, crop, and cutout lineage remains private.</p>
                  </div>
                  <ButtonLink href="/wardrobe">Open wardrobe</ButtonLink>
                  <Button
                    onClick={() => {
                      setJob(null);
                      setError(null);
                      setUserHint("");
                      setDirtyCandidates(new Set());
                    }}
                    variant="secondary"
                  >
                    <Plus size={15} /> Import another
                  </Button>
                </Card>
              ) : null}
              {job.status === "cancelled" ? (
                <Card className="import-complete-card">
                  <span>
                    <X size={22} />
                  </span>
                  <div>
                    <h2>Import cancelled</h2>
                    <p>No garments from this job were added to your wardrobe.</p>
                  </div>
                  <Button
                    onClick={() => {
                      setJob(null);
                      setError(null);
                    }}
                  >
                    Start a new import
                  </Button>
                </Card>
              ) : null}
            </>
          ) : null}
          <Card as="section" className="import-tip">
            <Sparkle size={21} weight="light" />
            <div>
              <h2>A better photo makes a better cutout</h2>
              <p>
                Use even light, keep the whole garment visible, and avoid covering sleeves, hems, or
                shoes.
              </p>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}
