export type ImageLimits = {
  maxBytes: number;
  maxPixels: number;
  maxEdge: number;
  minEdge: number;
};

export type ValidatedImage = {
  bytes: Buffer;
  mimeType: "image/png";
  width: number;
  height: number;
  originalFormat: "jpeg" | "png" | "webp";
};

export type CutoutDiagnostics = {
  visiblePixelRatio: number;
  touchesCanvasEdge: boolean;
  width: number;
  height: number;
};
