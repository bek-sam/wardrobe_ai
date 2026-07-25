const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function isIsoDate(value: string) {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function toUtcTime(isoDate: string) {
  return Date.parse(`${isoDate}T00:00:00.000Z`);
}

export function fromUtcTime(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  return fromUtcTime(toUtcTime(isoDate) + days * DAY_MS);
}

/** Whole days from `start` to `end`, inclusive of both endpoints. */
export function inclusiveDayCount(start: string, end: string) {
  return Math.floor((toUtcTime(end) - toUtcTime(start)) / DAY_MS) + 1;
}

/** 0 = Sunday, matching Date#getUTCDay. */
export function weekdayIndex(isoDate: string) {
  return new Date(toUtcTime(isoDate)).getUTCDay();
}

export function monthsBefore(isoDate: string, months: number) {
  const date = new Date(toUtcTime(isoDate));
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

export function startOfYear(isoDate: string) {
  return `${isoDate.slice(0, 4)}-01-01`;
}
