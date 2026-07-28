import type { ServerEnvironment } from "@/lib/env/server";

/** Rolling-limit half of a policy: always present, always abuse-protection. */
export type RollingQuota = {
  bucket: string;
  /** Env key holding the per-minute allowance for this bucket. */
  limitKey: keyof ServerEnvironment;
};

/** Daily half of a policy: null when the route spends no generation budget. */
export type DailyQuota = {
  feature: "stylist_generation" | "planner_generation";
  /** Env key holding the daily allowance for this feature. */
  limitKey: keyof ServerEnvironment;
};

export type QuotaPolicy = {
  rolling: RollingQuota;
  daily: DailyQuota | null;
};
