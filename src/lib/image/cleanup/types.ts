export type Rgb = readonly [number, number, number];

export type CleanupDiagnostics = {
  contaminatedPixels: number;
  visiblePixels: number;
  contaminationRatio: number;
  maxSpill: number;
  tolerance: number;
  accepted: boolean;
};
