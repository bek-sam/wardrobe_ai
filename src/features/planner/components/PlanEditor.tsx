import { PlanEditorFields } from "./PlanEditorFields";
import { PlanEditorFooter } from "./PlanEditorFooter";
import { PlanEditorHeader } from "./PlanEditorHeader";
import { usePlanEditorForm } from "./use-plan-editor-form";
import type { PlanEditorProps } from "./planner.types";

export function PlanEditor({ date, plan, outfits, onClose, onSaved, onDeleted }: PlanEditorProps) {
  const { form, setField, saving, error, submit, deletePlan } = usePlanEditorForm(
    date,
    plan,
    onSaved,
    onDeleted,
  );
  const closeSafely = () => {
    if (!saving) onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="plan-editor-title"
        aria-modal="true"
        className="planner-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <PlanEditorHeader disabled={saving} editing={Boolean(plan)} onClose={closeSafely} />
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <PlanEditorFields form={form} outfits={outfits} plan={plan} setField={setField} />
          <PlanEditorFooter
            editing={Boolean(plan)}
            error={error}
            onCancel={closeSafely}
            onDelete={() => void deletePlan()}
            saving={saving}
          />
        </form>
      </section>
    </div>
  );
}
