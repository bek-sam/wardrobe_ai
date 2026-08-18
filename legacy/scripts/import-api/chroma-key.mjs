import sharp from "sharp";
import { HEX_COLOR } from "./metadata.mjs";

export function chooseChromaKey(primary = "#808080") {
  const value = HEX_COLOR.test(primary) ? primary : "#808080";
  const source = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const candidates = [
    [0, 255, 0],
    [255, 0, 255],
    [0, 255, 255],
  ];
  const selected = candidates.sort((a, b) => {
    const distance = (color) =>
      color.reduce((total, channel, index) => total + (channel - source[index]) ** 2, 0);
    return distance(b) - distance(a);
  })[0];
  return `#${selected.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function cleanupTolerance(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(18, Math.min(110, Math.round(parsed))) : 46;
}

function removeKeyedSpill(data, index, keyedChannels, neutralLevel) {
  let remaining = Math.ceil(
    keyedChannels.reduce((total, channel) => total + data[index + channel], 0) -
      neutralLevel * keyedChannels.length,
  );
  let active = keyedChannels.filter((channel) => data[index + channel] > 0);
  while (remaining > 0 && active.length) {
    const share = Math.ceil(remaining / active.length);
    const next = [];
    for (const channel of active) {
      const reduction = Math.min(data[index + channel], share, remaining);
      data[index + channel] -= reduction;
      remaining -= reduction;
      if (data[index + channel] > 0) next.push(channel);
    }
    active = next;
  }
}

async function verifyNoChromaSpill(bytes, key) {
  const target = [1, 3, 5].map((offset) => Number.parseInt(key.slice(offset, offset + 2), 16));
  const keyedChannels = target
    .map((channel, index) => (channel > 200 ? index : null))
    .filter((index) => index !== null);
  const neutralChannels = target
    .map((channel, index) => (channel < 55 ? index : null))
    .filter((index) => index !== null);
  const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let contaminatedPixels = 0;
  let maxSpill = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const keyedLevel =
      keyedChannels.reduce((total, channel) => total + data[index + channel], 0) /
      keyedChannels.length;
    const neutralLevel =
      neutralChannels.reduce((total, channel) => total + data[index + channel], 0) /
      neutralChannels.length;
    const spill = Math.max(0, keyedLevel - neutralLevel);
    maxSpill = Math.max(maxSpill, spill);
    if (spill > 1.5) contaminatedPixels += 1;
  }
  return { contaminatedPixels, maxSpill };
}

export async function frameTransparentGarment(bytes, canvasSize = 1024, occupancy = 0.88) {
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let index = 0, pixel = 0; index < data.length; index += 4, pixel += 1) {
    if (data[index + 3] <= 8) continue;
    const x = pixel % info.width;
    const y = Math.floor(pixel / info.width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < minX || maxY < minY)
    throw new Error("Background removal did not leave a visible garment");

  const trimmed = await sharp(data, { raw: info })
    .extract({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 })
    .png()
    .toBuffer();
  const targetSize = Math.max(1, Math.round(canvasSize * Math.max(0.5, Math.min(0.96, occupancy))));
  const resized = await sharp(trimmed)
    .resize(targetSize, targetSize, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });
  const left = Math.floor((canvasSize - resized.info.width) / 2);
  const top = Math.floor((canvasSize - resized.info.height) / 2);
  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized.data, left, top }])
    .png()
    .toBuffer();
}

export async function processChromaBackground(bytes, key, options = {}) {
  const tolerance = cleanupTolerance(options.tolerance);
  const feather = 80;
  const target = [1, 3, 5].map((offset) => Number.parseInt(key.slice(offset, offset + 2), 16));
  const keyedChannels = target
    .map((channel, index) => (channel > 200 ? index : null))
    .filter((index) => index !== null);
  const neutralChannels = target
    .map((channel, index) => (channel < 55 ? index : null))
    .filter((index) => index !== null);
  const { data, info } = await sharp(bytes)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < data.length; index += 4) {
    const distance = Math.sqrt(
      (data[index] - target[0]) ** 2 +
        (data[index + 1] - target[1]) ** 2 +
        (data[index + 2] - target[2]) ** 2,
    );
    if (distance <= tolerance) {
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
    } else {
      if (distance < tolerance + feather)
        data[index + 3] = Math.round(data[index + 3] * ((distance - tolerance) / feather));
      const keyedLevel =
        keyedChannels.reduce((total, channel) => total + data[index + channel], 0) /
        keyedChannels.length;
      const neutralLevel =
        neutralChannels.reduce((total, channel) => total + data[index + channel], 0) /
        neutralChannels.length;
      const spill = Math.max(0, keyedLevel - neutralLevel);
      if (spill > 0) {
        const spillAlpha = Math.max(0, 1 - Math.max(0, spill - 4) / 150);
        data[index + 3] = Math.round(data[index + 3] * spillAlpha);
        removeKeyedSpill(data, index, keyedChannels, neutralLevel);
      }
      if (data[index + 3] <= 8) {
        data[index] = 0;
        data[index + 1] = 0;
        data[index + 2] = 0;
        data[index + 3] = 0;
      }
    }
  }
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] === 0) continue;
    const keyedLevel =
      keyedChannels.reduce((total, channel) => total + data[index + channel], 0) /
      keyedChannels.length;
    const neutralLevel =
      neutralChannels.reduce((total, channel) => total + data[index + channel], 0) /
      neutralChannels.length;
    const residualSpill = Math.max(0, keyedLevel - neutralLevel);
    if (residualSpill > 0) {
      removeKeyedSpill(data, index, keyedChannels, neutralLevel);
    }
  }
  const keyedOutput = await sharp(data, { raw: info }).png().toBuffer();
  const framedOutput = await frameTransparentGarment(keyedOutput);
  const { data: framedData, info: framedInfo } = await sharp(framedOutput)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let index = 0; index < framedData.length; index += 4) {
    if (framedData[index + 3] === 0) continue;
    const keyedLevel =
      keyedChannels.reduce((total, channel) => total + framedData[index + channel], 0) /
      keyedChannels.length;
    const neutralLevel =
      neutralChannels.reduce((total, channel) => total + framedData[index + channel], 0) /
      neutralChannels.length;
    const residualSpill = Math.max(0, keyedLevel - neutralLevel);
    if (residualSpill <= 0) continue;
    removeKeyedSpill(framedData, index, keyedChannels, neutralLevel);
  }
  const output = await sharp(framedData, { raw: framedInfo }).png().toBuffer();
  const verification = await verifyNoChromaSpill(output, key);
  return { bytes: output, verification, tolerance };
}

export async function removeChromaBackground(bytes, key, options = {}) {
  const result = await processChromaBackground(bytes, key, options);
  if (options.strict !== false && result.verification.contaminatedPixels > 1) {
    throw new Error(
      `Background cleanup left ${result.verification.contaminatedPixels} chroma-contaminated pixels`,
    );
  }
  return result.bytes;
}
