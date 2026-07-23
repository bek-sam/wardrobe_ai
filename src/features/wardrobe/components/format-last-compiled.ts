const dateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatLastCompiled(value: string | null) {
  if (!value) return "never";
  try {
    return dateFormatter.format(new Date(value));
  } catch {
    return "unknown";
  }
}
