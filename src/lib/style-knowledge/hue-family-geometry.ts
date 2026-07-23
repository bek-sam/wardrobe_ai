import { HUE_FAMILIES } from "./hue-families.data";

export function areAdjacent(familyA: string, familyB: string) {
  const indexA = HUE_FAMILIES.indexOf(familyA);
  const indexB = HUE_FAMILIES.indexOf(familyB);
  if (indexA === -1 || indexB === -1) return false;
  const distance = Math.abs(indexA - indexB);
  return distance === 1 || distance === HUE_FAMILIES.length - 1;
}

export function areOpposite(familyA: string, familyB: string) {
  const indexA = HUE_FAMILIES.indexOf(familyA);
  const indexB = HUE_FAMILIES.indexOf(familyB);
  if (indexA === -1 || indexB === -1) return false;
  const half = HUE_FAMILIES.length / 2;
  return Math.abs(indexA - indexB) === half;
}

export function areEvenlySpacedTriad(families: readonly string[]) {
  if (families.length !== 3) return false;
  const indices = families
    .map((family) => HUE_FAMILIES.indexOf(family))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b);
  const [first, second, third] = indices;
  if (indices.length !== 3 || first === undefined || second === undefined || third === undefined) {
    return false;
  }
  const gaps = [second - first, third - second, HUE_FAMILIES.length - (third - first)];
  const expected = HUE_FAMILIES.length / 3;
  return gaps.every((gap) => Math.abs(gap - expected) <= 1);
}
