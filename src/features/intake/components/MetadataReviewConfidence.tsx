import { Badge } from "@/components/ui/Badge";

import { confidenceLabel } from "./confidence-label";
import { titleCase } from "./import-text-helpers";

export function MetadataReviewConfidence({
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
