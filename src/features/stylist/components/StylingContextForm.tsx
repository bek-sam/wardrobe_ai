import { StylingContextBasicFields } from "./StylingContextBasicFields";
import { StylingContextSelectFields } from "./StylingContextSelectFields";
import type { useStylingContext } from "./use-styling-context";

export function StylingContextForm({ styling }: { styling: ReturnType<typeof useStylingContext> }) {
  return (
    <div className="stylist-context-form" aria-label="Styling context">
      <StylingContextBasicFields
        date={styling.date}
        location={styling.location}
        occasion={styling.occasion}
        onDate={styling.setDate}
        onLocation={styling.setLocation}
        onOccasion={styling.setOccasion}
      />
      <StylingContextSelectFields
        indoorOutdoor={styling.indoorOutdoor}
        onIndoorOutdoor={styling.setIndoorOutdoor}
        onTargetFormality={styling.setTargetFormality}
        targetFormality={styling.targetFormality}
      />
    </div>
  );
}
