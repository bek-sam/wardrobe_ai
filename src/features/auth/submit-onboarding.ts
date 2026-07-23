import { patchJson } from "./patch-json";

export async function submitOnboarding(form: {
  firstName: string;
  homeLocation: string;
  timezone: string;
  temperature: string;
  styles: string[];
  activities: string[];
}) {
  await patchJson("/api/profile", {
    first_name: form.firstName.trim() || null,
    home_location_name: form.homeLocation.trim() || null,
    timezone: form.timezone,
    onboarding_completed_at: new Date().toISOString(),
  });
  await patchJson("/api/style-profile", {
    style_keywords: form.styles,
    common_activities: form.activities,
    runs_cold: form.temperature === "cold" ? true : null,
    runs_hot: form.temperature === "hot" ? true : null,
  });
}
