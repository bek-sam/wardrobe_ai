import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;
export type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

export type OutfitPreviewJobRow = {
  id: string;
  user_id: string;
  candidate_id: string;
  source_hash: string;
  attempt_count: number;
};

export type CandidateMemberRow = { item_id: string; role: string; sort_order: number };

export type PreviewJobOutcome = "completed" | "failed" | "superseded";
