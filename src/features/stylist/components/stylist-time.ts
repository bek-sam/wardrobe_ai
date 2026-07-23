export function currentTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(),
  );
}

export function historyTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Saved message";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
