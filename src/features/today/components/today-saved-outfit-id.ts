import { isObject } from "@/lib/api/normalize";

import { uuidPattern } from "./today-constants.data";

export function savedOutfitId(value: unknown) {
  if (typeof value === "string" && uuidPattern.test(value)) return value;
  if (isObject(value) && typeof value.id === "string" && uuidPattern.test(value.id))
    return value.id;
  return null;
}
