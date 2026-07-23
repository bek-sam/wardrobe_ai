import type { AvailabilityStatus } from "./types";

export const AVAILABILITY_OPTIONS: Array<{ label: string; value: AvailabilityStatus }> = [
  { label: "Available", value: "available" },
  { label: "In laundry", value: "laundry" },
  { label: "Packed", value: "packed" },
  { label: "Loaned out", value: "loaned" },
  { label: "Needs repair", value: "repair" },
];

export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = Object.fromEntries(
  AVAILABILITY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<AvailabilityStatus, string>;
