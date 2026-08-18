import sharp from "sharp";

export type Rgb = readonly [number, number, number];

export type CleanupDiagnostics = {
  contaminatedPixels: number;
  visiblePixels: number;
  contaminationRatio: number;
  maxSpill: number;
  tolerance: number;
  accepted: boolean;
};

export function keyedAndNeutralChannels(target: Rgb) {
  const keyed = target.flatMap((channel, index) => (channel > 200 ? [index] : []));
  const neutral = target.flatMap((channel, index) => (channel < 55 ? [index] : []));
  return { keyed, neutral };
}

export function average(data: Buffer, index: number, channels: readonly number[]) {
  return (
    channels.reduce((total, channel) => total + (data[index + channel] ?? 0), 0) / channels.length
  );
}

export function suppressSpill(
  data: Buffer,
  index: number,
  keyed: readonly number[],
  neutralLevel: number,
) {
  for (const channel of keyed) {
    const value = data[index + channel] ?? 0;
    data[index + channel] = Math.min(value, Math.round(neutralLevel));
  }
}

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const CHROMA_KEYS: readonly Rgb[] = [
  [0, 255, 0],
  [255, 0, 255],
  [0, 255, 255],
];

export function hexToRgb(value: string): Rgb {
  const safe = HEX_COLOR.test(value) ? value : "#808080";
  return [1, 3, 5].map((offset) =>
    Number.parseInt(safe.slice(offset, offset + 2), 16),
  ) as unknown as Rgb;
}

export function colorDistance(first: Rgb, second: Rgb) {
  return first.reduce((total, channel, index) => total + (channel - (second[index] ?? 0)) ** 2, 0);
}

export function chooseChromaKey(garmentColors: readonly string[] = ["#808080"]): string {
  const fallback: Rgb = [0, 255, 0];
  const sourceColors = garmentColors.filter((color) => HEX_COLOR.test(color)).map(hexToRgb);
  if (sourceColors.length === 0) sourceColors.push(hexToRgb("#808080"));
  const selected =
    [...CHROMA_KEYS].sort((first, second) => {
      const firstMinimum = Math.min(...sourceColors.map((source) => colorDistance(first, source)));
      const secondMinimum = Math.min(
        ...sourceColors.map((source) => colorDistance(second, source)),
      );
      return secondMinimum - firstMinimum;
    })[0] ?? fallback;
  return `#${selected.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function findVisibleBounds(data: Buffer, width: number, height: number) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let pixel = 0, index = 0; index < data.length; pixel += 1, index += 4) {
    if ((data[index + 3] ?? 0) <= 8) continue;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY) throw new Error("Background removal left no visible garment.");

  return { minX, minY, maxX, maxY };
}

export async function frameTransparentGarment(
  bytes: Buffer,
  canvasSize = 1024,
  occupancy = 0.88,
): Promise<Buffer> {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { minX, minY, maxX, maxY } = findVisibleBounds(data, info.width, info.height);

  const trimmed = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
  const target = Math.round(canvasSize * Math.max(0.5, Math.min(0.96, occupancy)));
  const resized = await sharp(trimmed)
    .resize(target, target, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: resized.data,
        left: Math.floor((canvasSize - resized.info.width) / 2),
        top: Math.floor((canvasSize - resized.info.height) / 2),
      },
    ])
    .png()
    .toBuffer();
}

export function normalizeCleanupTolerance(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(18, Math.min(110, Math.round(parsed))) : 46;
}

export async function verifySpill(
  bytes: Buffer,
  target: Rgb,
  tolerance: number,
): Promise<CleanupDiagnostics> {
  const { keyed, neutral } = keyedAndNeutralChannels(target);
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let visiblePixels = 0;
  let contaminatedPixels = 0;
  let maxSpill = 0;
  for (let index = 0; index < data.length; index += 4) {
    if ((data[index + 3] ?? 0) <= 8) continue;
    visiblePixels += 1;
    const spill = Math.max(0, average(data, index, keyed) - average(data, index, neutral));
    maxSpill = Math.max(maxSpill, spill);
    if (spill > 2) contaminatedPixels += 1;
  }
  const contaminationRatio = visiblePixels === 0 ? 1 : contaminatedPixels / visiblePixels;
  return {
    contaminatedPixels,
    visiblePixels,
    contaminationRatio,
    maxSpill,
    tolerance,
    accepted: visiblePixels > 0 && contaminationRatio <= 0.0005,
  };
}

function keyPixel(
  data: Buffer,
  index: number,
  target: Rgb,
  keyed: readonly number[],
  neutral: readonly number[],
  tolerance: number,
  feather: number,
) {
  const pixel: Rgb = [data[index] ?? 0, data[index + 1] ?? 0, data[index + 2] ?? 0];
  const distance = Math.sqrt(colorDistance(pixel, target));
  if (distance <= tolerance) {
    data.fill(0, index, index + 4);
    return;
  }
  if (distance < tolerance + feather) {
    data[index + 3] = Math.round((data[index + 3] ?? 255) * ((distance - tolerance) / feather));
  }
  const neutralLevel = average(data, index, neutral);
  const spill = Math.max(0, average(data, index, keyed) - neutralLevel);
  if (spill > 0) {
    const alphaScale = Math.max(0, 1 - Math.max(0, spill - 4) / 150);
    data[index + 3] = Math.round((data[index + 3] ?? 255) * alphaScale);
    suppressSpill(data, index, keyed, neutralLevel);
  }
  if ((data[index + 3] ?? 0) <= 8) data.fill(0, index, index + 4);
}

export async function processChromaBackground(
  bytes: Buffer,
  chromaKey: string,
  options: { tolerance?: number } = {},
) {
  const tolerance = normalizeCleanupTolerance(options.tolerance);
  const feather = 80;
  const target = hexToRgb(chromaKey);
  const { keyed, neutral } = keyedAndNeutralChannels(target);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let index = 0; index < data.length; index += 4) {
    keyPixel(data, index, target, keyed, neutral, tolerance, feather);
  }

  const keyedOutput = await sharp(data, { raw: info }).png().toBuffer();
  const framed = await frameTransparentGarment(keyedOutput);
  const diagnostics = await verifySpill(framed, target, tolerance);
  return { bytes: framed, diagnostics };
}

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
