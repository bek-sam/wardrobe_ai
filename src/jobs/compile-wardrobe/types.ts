import type { WardrobeItemRole } from "@/features/wardrobe/types";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AdminClient = ReturnType<typeof createAdminClient>;
export type ServerEnvironment = ReturnType<typeof getServerEnvironment>;

export type WardrobeCompilationJobRow = {
  id: string;
  user_id: string;
  status: string;
  attempt_count: number;
};

export interface ChangeEventSummary {
  eventIds: string[];
  createdItemIds: Set<string>;
  deletedItemIds: Set<string>;
  changedItemIds: Set<string>;
  hasPreferenceChange: boolean;
  affectedItemIds: Set<string>;
}

export interface ReusableCandidateFields {
  curator_status: string;
  curator_rejection_reason: string | null;
  curator_confidence: number | null;
  curator_rank: number | null;
  curator_model: string | null;
  curator_prompt_version: string | null;
  curator_reviewed_at: string | null;
  style_tags: string[];
  preview_status: string;
  preview_bucket: string | null;
  preview_storage_path: string | null;
  preview_source_hash: string | null;
  preview_model: string | null;
  preview_generated_at: string | null;
  preview_error_code: string | null;
  times_suggested: number;
  last_suggested_at: string | null;
}

export type ReusableCandidateRow = ReusableCandidateFields & { combination_key: string };

export type CuratorCandidateRow = {
  id: string;
  combination_key: string;
  occasion_category: string | null;
  curator_status: string;
  created_at: string;
  total_score: number;
  formality_level: number | null;
  warmth_level: number | null;
  color_harmony: number | null;
  layering_quality: number | null;
  occasion_formality: number | null;
  preference_match: number | null;
  variety: number | null;
  weather_tags: string[] | null;
  outfit_candidate_items: { item_id: string; role: WardrobeItemRole }[] | null;
};
