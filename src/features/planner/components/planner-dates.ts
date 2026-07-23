export function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12, 0, 0, 0);
}

export function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shiftDate(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function formatWeekRange(dates: string[]) {
  if (!dates.length) return "Seven-day plan";
  const formatter = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
  const first = formatter.format(parseIsoDate(dates[0]!));
  const lastDate = parseIsoDate(dates[dates.length - 1]!);
  const last = formatter.format(lastDate);
  return `${first}–${last}, ${lastDate.getFullYear()}`;
}
