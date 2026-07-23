export function findVisibleBounds(data: Buffer, width: number, height: number) {
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
