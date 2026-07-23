import type { PlanView } from "./planner.types";

export function PlanEditorLocationStatusFields({
  locationName,
  onLocationName,
  plan,
  status,
  onStatus,
}: {
  locationName: string;
  onLocationName: (value: string) => void;
  plan: PlanView | null;
  status: "planned" | "skipped";
  onStatus: (value: "planned" | "skipped") => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Location</span>
        <input
          className="text-input"
          maxLength={200}
          onChange={(event) => onLocationName(event.target.value)}
          placeholder="Use home location when blank"
          value={locationName}
        />
      </label>
      {plan ? (
        plan.status === "worn" ? (
          <p className="form-field__hint">Worn status is historical and will be preserved.</p>
        ) : (
          <label className="form-field">
            <span>Status</span>
            <select
              className="select-input"
              onChange={(event) => onStatus(event.target.value as "planned" | "skipped")}
              value={status}
            >
              <option value="planned">Planned</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
        )
      ) : null}
    </>
  );
}
