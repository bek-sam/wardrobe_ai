import { isObject } from "@/lib/api/normalize";

export function relationObject(value: unknown) {
  if (Array.isArray(value)) return isObject(value[0]) ? value[0] : null;
  return isObject(value) ? value : null;
}
