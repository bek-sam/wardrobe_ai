import type { TodayProfile } from "./today.types";

export function greeting(profile: TodayProfile | null) {
  let hour = new Date().getHours();
  if (profile) {
    try {
      const value = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone: profile.timezone,
      })
        .formatToParts(new Date())
        .find((part) => part.type === "hour")?.value;
      if (value) hour = Number(value);
    } catch {
      // Fall back to the browser clock when a stale timezone cannot be formatted.
    }
  }
  const salutation = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile?.firstName ?? profile?.displayName;
  return `${salutation}${name ? `, ${name}` : ""}.`;
}
