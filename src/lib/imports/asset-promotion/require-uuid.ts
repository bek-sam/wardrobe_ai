import { uuidSchema } from "./schemas";

export function requireUuid(value: string, label: string) {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} must be a UUID.`);
  return parsed.data;
}
