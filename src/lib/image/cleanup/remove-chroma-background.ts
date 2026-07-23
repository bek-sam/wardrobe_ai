import { processChromaBackground } from "./process-chroma-background";

export async function removeChromaBackground(
  bytes: Buffer,
  chromaKey: string,
  options: { tolerance?: number; strict?: boolean } = {},
): Promise<Buffer> {
  const result = await processChromaBackground(bytes, chromaKey, options);
  if (options.strict !== false && !result.diagnostics.accepted) {
    throw new Error(
      `Background cleanup left ${result.diagnostics.contaminatedPixels} contaminated pixels.`,
    );
  }
  return result.bytes;
}
