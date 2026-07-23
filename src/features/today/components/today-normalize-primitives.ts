export function safeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function safeStrings(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
        .map((entry) => entry.trim())
        .slice(0, maximum)
    : [];
}
