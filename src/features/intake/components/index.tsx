"use client";

import { Check, SpinnerGap, X } from "@phosphor-icons/react";
import type { CandidateStatus } from "./import-model";
import { useState } from "react";
import { Button } from "@/components/ui";
import { titleCase } from "./import-model";
import type { BoundingBox, CropReviewProps } from "./import-model";
import type { MetadataForm, MetadataSetField } from "./import-model";
import { categoryOptions } from "./import-model";
import { type FormEvent } from "react";
import { formFromMetadata, metadataFromForm } from "./import-model";
import type { MetadataReviewProps } from "./import-model";
import { Badge } from "@/components/ui";
import { confidenceLabel } from "./import-model";
import { ArrowClockwise } from "@phosphor-icons/react";
import type { CandidateCardProps } from "./import-model";
import { WarningCircle } from "@phosphor-icons/react";
import type { CutoutReviewProps } from "./import-model";
import type { Dispatch, SetStateAction } from "react";
import type { CandidateMetadata, CandidateView } from "./import-model";
import { Card } from "@/components/ui";
import { Crop, Sparkle } from "@phosphor-icons/react";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { Plus } from "@phosphor-icons/react";
import { ButtonLink } from "@/components/ui";
import { steps } from "./import-model";
import type { ChangeEvent, RefObject } from "react";
import { UploadSimple } from "@phosphor-icons/react";
import type { UploadDropzoneProps } from "./import-model";
import type { DragEvent } from "react";
import { Camera, ImageSquare } from "@phosphor-icons/react";
import type { ImportJobView } from "./import-model";
import type { ImportJobPanelProps } from "./import-model";
import type { CandidateSectionProps } from "./import-model";
import { useImportWorkspaceState } from "./import-model";
import { PageHeader } from "@/components/ui";
import { DemoNotice } from "@/components/ui";

export function CandidateProcessingStatus({ status }: { status: CandidateStatus }) {
  if (["detected", "extracting", "researching"].includes(status)) {
    return (
      <div className="candidate-processing" aria-live="polite">
        <SpinnerGap className="spin" size={18} />
        <span>
          {status === "extracting"
            ? "Creating a clean private cutout…"
            : "Processing this garment…"}
        </span>
      </div>
    );
  }
  if (status === "approved") {
    return (
      <p className="inline-feedback inline-feedback--success">
        <Check size={16} /> Saved to your wardrobe
      </p>
    );
  }
  if (status === "rejected") {
    return (
      <p className="inline-feedback">
        <X size={16} /> Skipped — this garment will not be saved
      </p>
    );
  }
  return null;
}

export function CropReview({ candidate, busy, onApprove }: CropReviewProps) {
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

function MetadataReviewCategoryField({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
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
  );
}

function MetadataReviewNameField({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
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
  );
}

export function MetadataReviewBasicFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
      <MetadataReviewNameField form={form} setField={setField} />
      <MetadataReviewCategoryField form={form} setField={setField} />
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
    </>
  );
}

function OptionalColorField({
  label,
  ariaLabel,
  value,
  defaultValue,
  onChange,
}: {
  label: string;
  ariaLabel: string;
  value: string;
  defaultValue: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="form-field">
      <span>{label}</span>
      <div className="optional-color-row">
        <input
          aria-label={ariaLabel}
          disabled={!value}
          onChange={(event) => onChange(event.target.value)}
          type="color"
          value={value || defaultValue}
        />
        <label className="check-row">
          <input
            checked={Boolean(value)}
            onChange={(event) => onChange(event.target.checked ? defaultValue : "")}
            type="checkbox"
          />
          Include
        </label>
      </div>
    </div>
  );
}

export function MetadataReviewColorFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
      <OptionalColorField
        ariaLabel="Primary garment color"
        defaultValue="#8b7d6b"
        label="Primary color"
        onChange={(value) => setField("primaryColorHex", value)}
        value={form.primaryColorHex}
      />
      <OptionalColorField
        ariaLabel="Secondary garment color"
        defaultValue="#d6d0c5"
        label="Secondary color"
        onChange={(value) => setField("secondaryColorHex", value)}
        value={form.secondaryColorHex}
      />
    </>
  );
}

function MetadataReviewDetailFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
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
    </>
  );
}

function MetadataReviewTagFields({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <>
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
    </>
  );
}

function MetadataReviewNotesField({
  form,
  setField,
}: {
  form: MetadataForm;
  setField: MetadataSetField;
}) {
  return (
    <label className="form-field">
      <span>Notes</span>
      <textarea
        className="textarea-input"
        maxLength={2000}
        onChange={(event) => setField("notes", event.target.value)}
        value={form.notes}
      />
    </label>
  );
}

function MetadataReviewActions({
  busy,
  canSubmit,
  regenerationOpen,
  onToggleRegeneration,
  onRegenerate,
  cleanupTolerance,
}: {
  busy: boolean;
  canSubmit: boolean;
  regenerationOpen: boolean;
  onToggleRegeneration: () => void;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
  cleanupTolerance: number;
}) {
  return (
    <>
      <div className="metadata-review-form__actions">
        <Button disabled={busy || !canSubmit} type="submit">
          {busy ? <SpinnerGap className="spin" size={15} /> : <Check size={15} />}
          Save reviewed details
        </Button>
        <Button onClick={onToggleRegeneration} type="button" variant="ghost">
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
                cleanupTolerance,
              )
            }
            type="button"
            variant="secondary"
          >
            Regenerate cutout
          </Button>
        </div>
      ) : null}
    </>
  );
}

function MetadataReviewConfidence({
  fieldConfidence,
}: {
  fieldConfidence: Record<string, number>;
}) {
  const confidence = confidenceLabel(fieldConfidence);
  return (
    <>
      <Badge tone={confidence.tone}>{confidence.label}</Badge>
      {Object.keys(fieldConfidence).length ? (
        <div className="field-confidence-list" aria-label="AI confidence by field">
          {Object.entries(fieldConfidence).map(([field, value]) => (
            <span key={field}>
              {titleCase(field)} <strong>{Math.round(value * 100)}%</strong>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

export function MetadataReview({
  candidate,
  busy,
  onDirty,
  onSave,
  onRegenerate,
}: MetadataReviewProps) {
  const [form, setForm] = useState<MetadataForm>(() => formFromMetadata(candidate.metadata));
  const [regenerationOpen, setRegenerationOpen] = useState(false);

  const setField: MetadataSetField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    onDirty(true);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await onSave(metadataFromForm(form));
    if (saved) onDirty(false);
  }

  return (
    <form className="metadata-review-form" onSubmit={(event) => void submit(event)}>
      <MetadataReviewConfidence fieldConfidence={candidate.fieldConfidence} />
      <div className="form-grid form-grid--two">
        <MetadataReviewBasicFields form={form} setField={setField} />
        <MetadataReviewColorFields form={form} setField={setField} />
        <MetadataReviewDetailFields form={form} setField={setField} />
        <MetadataReviewTagFields form={form} setField={setField} />
      </div>
      <MetadataReviewNotesField form={form} setField={setField} />
      <MetadataReviewActions
        busy={busy}
        canSubmit={Boolean(form.name.trim())}
        cleanupTolerance={candidate.cleanupTolerance}
        onRegenerate={onRegenerate}
        onToggleRegeneration={() => setRegenerationOpen((open) => !open)}
        regenerationOpen={regenerationOpen}
      />
    </form>
  );
}

export function RegeneratePanel({
  open,
  busy,
  initialTolerance,
  onRegenerate,
}: {
  open: boolean;
  busy: boolean;
  initialTolerance: number;
  onRegenerate: (instruction: string, tolerance: number) => Promise<void>;
}) {
  const [instruction, setInstruction] = useState("");
  const [tolerance, setTolerance] = useState(initialTolerance);
  return (
    <details className="regenerate-panel" open={open}>
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
  );
}

function CutoutReview({ candidate, busy, onApprove, onRegenerate }: CutoutReviewProps) {
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
      <RegeneratePanel
        busy={busy}
        initialTolerance={candidate.cleanupTolerance}
        onRegenerate={onRegenerate}
        open={candidate.status === "failed"}
      />
    </div>
  );
}

export function CandidateReviewStep(props: CandidateCardProps) {
  const { candidate, busy, onDirty, onApproveCrop, onApproveCutout, onRegenerate, onSaveMetadata } =
    props;
  if (candidate.status === "review_crop") {
    return <CropReview busy={busy} candidate={candidate} onApprove={onApproveCrop} />;
  }
  if (candidate.status === "review_cutout" || candidate.status === "failed") {
    return (
      <CutoutReview
        busy={busy}
        candidate={candidate}
        onApprove={onApproveCutout}
        onRegenerate={onRegenerate}
      />
    );
  }
  if (candidate.status === "review_metadata") {
    return (
      <MetadataReview
        busy={busy}
        candidate={candidate}
        onDirty={onDirty}
        onRegenerate={onRegenerate}
        onSave={onSaveMetadata}
      />
    );
  }
  return null;
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

const reviewStatuses = ["review_crop", "review_cutout", "review_metadata", "failed"];

function CandidateCard(props: CandidateCardProps) {
  const { candidate, busy, onReject } = props;
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
        <CandidateReviewStep {...props} />
        <CandidateProcessingStatus status={candidate.status} />
        {reviewStatuses.includes(candidate.status) ? (
          <Button disabled={busy} onClick={() => void onReject()} type="button" variant="ghost">
            <X size={15} /> Skip this garment
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

export function CandidateGridItem({
  candidate,
  busy,
  setDirtyCandidates,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
}: {
  candidate: CandidateView;
  busy: boolean;
  setDirtyCandidates: Dispatch<SetStateAction<Set<string>>>;
  onApproveCrop: (candidate: CandidateView, box: BoundingBox) => Promise<void>;
  onApproveCutout: (candidate: CandidateView) => Promise<void>;
  onReject: (candidate: CandidateView) => Promise<void>;
  onRegenerate: (candidate: CandidateView, instruction: string, tolerance: number) => Promise<void>;
  onSaveMetadata: (candidate: CandidateView, metadata: CandidateMetadata) => Promise<boolean>;
}) {
  return (
    <CandidateCard
      busy={busy}
      candidate={candidate}
      onApproveCrop={(box) => onApproveCrop(candidate, box)}
      onApproveCutout={() => onApproveCutout(candidate)}
      onDirty={(dirty) =>
        setDirtyCandidates((current) => {
          const next = new Set(current);
          if (dirty) next.add(candidate.id);
          else next.delete(candidate.id);
          return next;
        })
      }
      onReject={() => onReject(candidate)}
      onRegenerate={(instruction, tolerance) => onRegenerate(candidate, instruction, tolerance)}
      onSaveMetadata={(metadata) => onSaveMetadata(candidate, metadata)}
    />
  );
}

export function ImportCompleteCard({ onStartAnother }: { onStartAnother: () => void }) {
  return (
    <Card className="import-complete-card">
      <span>
        <Check size={24} weight="bold" />
      </span>
      <div>
        <h2>Your reviewed pieces are in Wardrobe</h2>
        <p>The original, crop, and cutout lineage remains private.</p>
      </div>
      <ButtonLink href="/wardrobe">Open wardrobe</ButtonLink>
      <Button onClick={onStartAnother} variant="secondary">
        <Plus size={15} /> Import another
      </Button>
    </Card>
  );
}

export function ImportSteps({ current }: { current: number }) {
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

export function UploadFileInputs({
  fileInput,
  cameraInput,
  onSelectFile,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onSelectFile}
        ref={fileInput}
        type="file"
      />
      <input
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="sr-only"
        onChange={onSelectFile}
        ref={cameraInput}
        type="file"
      />
    </>
  );
}

function UploadDropzoneButtons({
  fileInput,
  cameraInput,
  uploadStage,
}: {
  fileInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  uploadStage: string;
}) {
  return (
    <div>
      <Button disabled={uploadStage !== "idle"} onClick={() => fileInput.current?.click()}>
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
  );
}

function createDragDropHandlers(
  setDragging: (value: boolean) => void,
  onDropFile: (file: File) => void,
) {
  return {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(true);
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (event.currentTarget === event.target) setDragging(false);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => event.preventDefault(),
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setDragging(false);
      const file = Array.from(event.dataTransfer.files).find((entry) =>
        entry.type.startsWith("image/"),
      );
      if (file) onDropFile(file);
    },
  };
}

export function UploadDropzone({
  fileInput,
  cameraInput,
  dragging,
  setDragging,
  uploadStage,
  onSelectFile,
  onDropFile,
}: UploadDropzoneProps) {
  return (
    <section
      aria-labelledby="upload-title"
      className={`upload-zone${dragging ? " is-dragging" : ""}`}
      {...createDragDropHandlers(setDragging, onDropFile)}
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
      <UploadDropzoneButtons
        cameraInput={cameraInput}
        fileInput={fileInput}
        uploadStage={uploadStage}
      />
      <small>Or paste an image from your clipboard</small>
      <UploadFileInputs
        cameraInput={cameraInput}
        fileInput={fileInput}
        onSelectFile={onSelectFile}
      />
    </section>
  );
}

function UploadHintField({
  userHint,
  onChange,
}: {
  userHint: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-field import-hint-field">
      <span>Optional note for detection</span>
      <input
        className="text-input"
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Example: the scarf belongs to this outfit too"
        value={userHint}
      />
    </label>
  );
}

function LocalUploadPreview({
  localPreviewUrl,
  uploadStage,
}: {
  localPreviewUrl: string;
  uploadStage: string;
}) {
  return (
    <div className="local-upload-preview" aria-live="polite">
      {/* Blob URLs are local-only previews and are revoked after signing or unmount. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Selected upload preview" src={localPreviewUrl} />
      <span>{titleCase(uploadStage)}</span>
    </div>
  );
}

export function ImportUploadSection({
  userHint,
  setUserHint,
  fileInput,
  cameraInput,
  dragging,
  setDragging,
  uploadStage,
  onSelectFile,
  onDropFile,
  localPreviewUrl,
}: {
  userHint: string;
  setUserHint: (value: string) => void;
  fileInput: RefObject<HTMLInputElement | null>;
  cameraInput: RefObject<HTMLInputElement | null>;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  uploadStage: string;
  onSelectFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onDropFile: (file: File) => void;
  localPreviewUrl: string | null;
}) {
  return (
    <>
      <UploadHintField onChange={setUserHint} userHint={userHint} />
      <UploadDropzone
        cameraInput={cameraInput}
        dragging={dragging}
        fileInput={fileInput}
        onDropFile={onDropFile}
        onSelectFile={onSelectFile}
        setDragging={setDragging}
        uploadStage={uploadStage}
      />
      {localPreviewUrl ? (
        <LocalUploadPreview localPreviewUrl={localPreviewUrl} uploadStage={uploadStage} />
      ) : null}
    </>
  );
}

function ConfirmImportCard({
  canConfirm,
  busy,
  dirtyCount,
  onConfirm,
}: {
  canConfirm: boolean;
  busy: boolean;
  dirtyCount: number;
  onConfirm: () => void;
}) {
  return (
    <Card className="confirm-import-card">
      <div>
        <p className="eyebrow">Final check</p>
        <h2>Add reviewed garments to your wardrobe</h2>
        <p>
          Save any edited detail cards first. Only these detected, approved pieces will be created.
        </p>
        {dirtyCount ? <small>{dirtyCount} card has unsaved changes.</small> : null}
      </div>
      <Button disabled={!canConfirm} onClick={onConfirm}>
        {busy ? <SpinnerGap className="spin" size={16} /> : <Check size={16} />}
        Confirm &amp; save
      </Button>
    </Card>
  );
}

function ImportCancelledCard({ onStartNew }: { onStartNew: () => void }) {
  return (
    <Card className="import-complete-card">
      <span>
        <X size={22} />
      </span>
      <div>
        <h2>Import cancelled</h2>
        <p>No garments from this job were added to your wardrobe.</p>
      </div>
      <Button onClick={onStartNew}>Start a new import</Button>
    </Card>
  );
}

export function ImportJobStatusCards({
  job,
  busyAction,
  canConfirm,
  dirtyCount,
  onConfirm,
  onStartAnother,
  onStartNew,
}: {
  job: ImportJobView;
  busyAction: string | null;
  canConfirm: boolean;
  dirtyCount: number;
  onConfirm: () => void;
  onStartAnother: () => void;
  onStartNew: () => void;
}) {
  if (job.status === "review_metadata") {
    return (
      <ConfirmImportCard
        busy={busyAction === "confirm"}
        canConfirm={canConfirm}
        dirtyCount={dirtyCount}
        onConfirm={onConfirm}
      />
    );
  }
  if (job.status === "complete") return <ImportCompleteCard onStartAnother={onStartAnother} />;
  if (job.status === "cancelled") return <ImportCancelledCard onStartNew={onStartNew} />;
  return null;
}

function ImportProgressCard({
  job,
  activelyProcessing,
}: {
  job: ImportJobView;
  activelyProcessing: boolean;
}) {
  return (
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
      {activelyProcessing ? (
        <p className="import-progress-card__status" role="status">
          <SpinnerGap className="spin" size={16} /> AI processing may take a few minutes. You can
          return to this page without losing the job.
        </p>
      ) : null}
      {job.errorMessage ? (
        <p className="inline-feedback inline-feedback--error">
          <WarningCircle size={16} /> {job.errorMessage}
        </p>
      ) : null}
    </Card>
  );
}

function CandidateSection({
  candidates,
  busyAction,
  setDirtyCandidates,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
}: CandidateSectionProps) {
  return (
    <section className="candidate-section" aria-labelledby="candidate-title">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Review required</p>
          <h2 id="candidate-title">
            {candidates.length} {candidates.length === 1 ? "garment" : "garments"} detected
          </h2>
        </div>
        <Badge tone="outline">Nothing saves without confirmation</Badge>
      </div>
      <div className="candidate-grid candidate-grid--review">
        {candidates.map((candidate) => (
          <CandidateGridItem
            busy={busyAction === candidate.id}
            candidate={candidate}
            key={candidate.id}
            onApproveCrop={onApproveCrop}
            onApproveCutout={onApproveCutout}
            onReject={onReject}
            onRegenerate={onRegenerate}
            onSaveMetadata={onSaveMetadata}
            setDirtyCandidates={setDirtyCandidates}
          />
        ))}
      </div>
    </section>
  );
}

function OriginalImageReview({ originalImageUrl }: { originalImageUrl: string }) {
  return (
    <details className="original-image-review">
      <summary>View private original</summary>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="Original import" src={originalImageUrl} />
    </details>
  );
}

export function ImportJobPanel({
  job,
  busyAction,
  activelyProcessing,
  dirtyCandidates,
  setDirtyCandidates,
  canConfirm,
  onConfirm,
  onApproveCrop,
  onApproveCutout,
  onReject,
  onRegenerate,
  onSaveMetadata,
  onStartAnother,
  onStartNew,
}: ImportJobPanelProps) {
  return (
    <>
      <ImportProgressCard activelyProcessing={activelyProcessing} job={job} />
      {job.originalImageUrl && <OriginalImageReview originalImageUrl={job.originalImageUrl} />}
      {job.candidates.length ? (
        <CandidateSection
          busyAction={busyAction}
          candidates={job.candidates}
          onApproveCrop={onApproveCrop}
          onApproveCutout={onApproveCutout}
          onReject={onReject}
          onRegenerate={onRegenerate}
          onSaveMetadata={onSaveMetadata}
          setDirtyCandidates={setDirtyCandidates}
        />
      ) : null}
      <ImportJobStatusCards
        busyAction={busyAction}
        canConfirm={canConfirm}
        dirtyCount={dirtyCandidates.size}
        job={job}
        onConfirm={onConfirm}
        onStartAnother={onStartAnother}
        onStartNew={onStartNew}
      />
    </>
  );
}

function ImportJobContent({
  job,
  state,
}: {
  job: ImportJobView;
  state: ReturnType<typeof useImportWorkspaceState>;
}) {
  const { fields, derived, candidateActions, confirmImport } = state;
  return (
    <ImportJobPanel
      activelyProcessing={derived.activeProcessing || fields.uploadStage === "processing"}
      busyAction={fields.busyAction}
      canConfirm={derived.canConfirm}
      dirtyCandidates={fields.dirtyCandidates}
      job={job}
      onApproveCrop={candidateActions.approveCrop}
      onApproveCutout={candidateActions.approveCutout}
      onConfirm={() => void confirmImport()}
      onReject={candidateActions.rejectCandidate}
      onRegenerate={candidateActions.regenerate}
      onSaveMetadata={candidateActions.saveMetadata}
      onStartAnother={() => {
        fields.setJob(null);
        fields.setError(null);
        fields.setUserHint("");
        fields.setDirtyCandidates(new Set());
      }}
      onStartNew={() => {
        fields.setJob(null);
        fields.setError(null);
      }}
      setDirtyCandidates={fields.setDirtyCandidates}
    />
  );
}

function ImportLoadingCard() {
  return (
    <Card className="import-loading" role="status">
      <SpinnerGap className="spin" size={21} /> Checking for an unfinished import…
    </Card>
  );
}

function ImportIdleContent({ state }: { state: ReturnType<typeof useImportWorkspaceState> }) {
  const { fields, upload } = state;
  if (fields.loadingExisting) return <ImportLoadingCard />;
  return (
    <ImportUploadSection
      cameraInput={fields.cameraInput}
      dragging={fields.dragging}
      fileInput={fields.fileInput}
      localPreviewUrl={upload.localPreviewUrl}
      onDropFile={(file) => void upload.processFile(file)}
      onSelectFile={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void upload.processFile(file);
      }}
      setDragging={fields.setDragging}
      setUserHint={fields.setUserHint}
      uploadStage={fields.uploadStage}
      userHint={fields.userHint}
    />
  );
}

function ImportJobOrUpload({ state }: { state: ReturnType<typeof useImportWorkspaceState> }) {
  return state.fields.job ? (
    <ImportJobContent job={state.fields.job} state={state} />
  ) : (
    <ImportIdleContent state={state} />
  );
}

function ImportErrorBanner({
  error,
  showResume,
  onResume,
}: {
  error: string;
  showResume: boolean;
  onResume: () => void;
}) {
  return (
    <div className="inline-feedback inline-feedback--error" role="alert">
      <WarningCircle size={17} />
      <span>{error}</span>
      {showResume ? (
        <Button onClick={onResume} variant="ghost">
          Resume processing
        </Button>
      ) : null}
    </div>
  );
}

function ImportTipCard() {
  return (
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
  );
}

export function ImportConfiguredView({
  state,
}: {
  state: ReturnType<typeof useImportWorkspaceState>;
}) {
  const { fields, derived, startProcessing } = state;
  const showResume =
    Boolean(fields.job) &&
    (["queued", "analyzing", "extracting", "failed"].includes(fields.job!.status) ||
      fields.job!.candidates.some((candidate) => candidate.status === "extracting"));
  return (
    <>
      <ImportSteps current={derived.currentStep} />
      {fields.error ? (
        <ImportErrorBanner
          error={fields.error}
          onResume={() => startProcessing(fields.job!.id)}
          showResume={showResume}
        />
      ) : null}
      <ImportJobOrUpload state={state} />
      <ImportTipCard />
    </>
  );
}

function ImportWorkspaceHeader({
  showCancel,
  cancelBusy,
  onCancel,
}: {
  showCancel: boolean;
  cancelBusy: boolean;
  onCancel: () => void;
}) {
  return (
    <PageHeader
      actions={
        showCancel ? (
          <Button disabled={cancelBusy} onClick={onCancel} variant="ghost">
            <X size={15} /> Cancel import
          </Button>
        ) : undefined
      }
      description="One garment or a full outfit works. Nothing is saved until you approve it."
      eyebrow="Add clothes"
      title="Import by photo"
    />
  );
}

export function ImportWorkspace({ configured }: { configured: boolean }) {
  const state = useImportWorkspaceState(configured);
  const { fields, cancelImport } = state;

  return (
    <div className="page-stack import-page">
      <ImportWorkspaceHeader
        cancelBusy={fields.busyAction === "cancel"}
        onCancel={() => void cancelImport()}
        showCancel={Boolean(fields.job && !["complete", "cancelled"].includes(fields.job.status))}
      />
      {configured ? <ImportConfiguredView state={state} /> : <PreviewImport />}
    </div>
  );
}

const sampleCandidates = [
  { name: "Stone Oxford Shirt", category: "top" as const, color: "#ddd4c2" },
  { name: "Navy Trouser", category: "bottom" as const, color: "#293647" },
];

function PreviewCandidateGrid() {
  return (
    <section className="candidate-section" aria-labelledby="preview-candidate-title">
      <div className="card-title-row">
        <div>
          <p className="eyebrow">Workflow preview</p>
          <h2 id="preview-candidate-title">2 sample garments</h2>
        </div>
        <Badge tone="outline">Sample candidates</Badge>
      </div>
      <div className="candidate-grid">
        {sampleCandidates.map((item) => (
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
  );
}

export function PreviewImport() {
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
      <PreviewCandidateGrid />
    </>
  );
}
