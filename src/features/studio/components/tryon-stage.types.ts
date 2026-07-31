import type { StudioVariant, StudioVisualization } from "../types";

export type TryOnStageProps = {
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
