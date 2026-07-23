export function commaSeparated(value: string) {
  return [
    ...new Set(
      value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  ].slice(0, 50);
}

export function objectString(value: Record<string, unknown> | undefined, key: string) {
  const entry = value?.[key];
  return typeof entry === "string" ? entry : "";
}

export function scrollTo(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
