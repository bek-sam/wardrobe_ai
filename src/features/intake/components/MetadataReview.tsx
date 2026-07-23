import { useState, type FormEvent } from "react";

import { formFromMetadata, metadataFromForm } from "./metadata-form-mapping";
import { MetadataReviewActions } from "./MetadataReviewActions";
import { MetadataReviewBasicFields } from "./MetadataReviewBasicFields";
import { MetadataReviewColorFields } from "./MetadataReviewColorFields";
import { MetadataReviewConfidence } from "./MetadataReviewConfidence";
import { MetadataReviewDetailFields } from "./MetadataReviewDetailFields";
import { MetadataReviewNotesField } from "./MetadataReviewNotesField";
import { MetadataReviewTagFields } from "./MetadataReviewTagFields";
import type { MetadataForm, MetadataReviewProps, MetadataSetField } from "./import-workspace.types";

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
