import { GenerateDayList } from "./GenerateDayList";
import { GenerateDialogFooter } from "./GenerateDialogFooter";
import { GenerateDialogHeader } from "./GenerateDialogHeader";
import { GenerateLocationField } from "./GenerateLocationField";
import { useGenerateDays } from "./use-generate-days";
import { useGenerateSubmit } from "./use-generate-submit";
import type { PlanView } from "./planner.types";

export function GenerateDialog({
  dates,
  plans,
  onClose,
  onGenerated,
}: {
  dates: string[];
  plans: PlanView[];
  onClose: () => void;
  onGenerated: (message: string) => void;
}) {
  const { days, toggleSelected, setOccasion } = useGenerateDays(dates, plans);
  const { location, setLocation, generating, error, submit } = useGenerateSubmit(days, onGenerated);
  const closeSafely = () => {
    if (!generating) onClose();
  };

  return (
    <div className="dialog-backdrop" onMouseDown={closeSafely} role="presentation">
      <section
        aria-labelledby="generate-week-title"
        aria-modal="true"
        className="planner-dialog planner-generate-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <GenerateDialogHeader disabled={generating} onClose={closeSafely} />
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
          <GenerateLocationField location={location} onLocation={setLocation} />
          <GenerateDayList days={days} onOccasion={setOccasion} onToggleSelected={toggleSelected} />
          <GenerateDialogFooter
            canSubmit={days.some((day) => day.selected)}
            error={error}
            generating={generating}
            onCancel={closeSafely}
          />
        </form>
      </section>
    </div>
  );
}
