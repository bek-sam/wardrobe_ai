import {
  retryAt,
  type AdminClient,
  type OutfitPreviewJobRow,
  type ServerEnvironment,
} from "./contracts";

export async function checkConsentAndQuota(
  admin: AdminClient,
  environment: ServerEnvironment,
  job: OutfitPreviewJobRow,
): Promise<{ identityReferencePath: string } | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("modeled_preview_consent, identity_reference_path")
    .eq("id", job.user_id)
    .maybeSingle();
  if (!profile?.modeled_preview_consent || !profile.identity_reference_path) {
    await admin.rpc("fail_outfit_preview_job", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_error_code: "consent_not_active",
      p_error_message: "Modeled preview consent is not active.",
      p_next_attempt_at: null,
    });
    return null;
  }

  const { data: quota } = await admin.rpc("service_check_and_increment_usage_window", {
    p_user_id: job.user_id,
    p_feature: "outfit_preview_generation",
    p_limit: environment.PREVIEW_DAILY_LIMIT,
    p_period: "day",
    p_increment: 1,
  });
  if (!(quota as { allowed?: boolean } | null)?.allowed) {
    await admin.rpc("fail_outfit_preview_job", {
      p_job_id: job.id,
      p_user_id: job.user_id,
      p_error_code: "daily_preview_limit_reached",
      p_error_message: "Daily preview generation limit reached.",
      p_next_attempt_at: retryAt(job.attempt_count),
    });
    return null;
  }

  return { identityReferencePath: profile.identity_reference_path as string };
}
