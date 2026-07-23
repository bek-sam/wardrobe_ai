import type { Rgb } from "./types";

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
