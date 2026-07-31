import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { insertWardrobeItem } from "./helpers";

export const CONSENT_VERSION = "tryon@2026-07";

function sha(seed: string) {
  return seed
    .padEnd(64, "0")
    .slice(0, 64)
    .replace(/[^0-9a-f]/g, "a");
}

/** An active, consented identity reference, created the way the RPC expects. */
export async function seedIdentityReference(
  admin: SupabaseClient,
  userId: string,
  client: SupabaseClient,
) {
  const { data, error } = await admin
    .from("profile_identity_references")
    .insert({
      user_id: userId,
      bucket_id: "profile-references",
      storage_path: `${userId}/identity/${randomUUID()}.png`,
      sha256: sha("f"),
      normalized_mime: "image/png",
      width: 1024,
      height: 1536,
      validation_status: "pass",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("identity reference insert failed");

  const { error: activateError } = await client.rpc("activate_identity_reference", {
    p_reference_id: data.id,
    p_consent_version: CONSENT_VERSION,
  });
  if (activateError) throw activateError;
  return data.id as string;
}

export async function seedFoundation(admin: SupabaseClient, userId: string) {
  const top = await insertWardrobeItem(admin, userId, { layer_role: "top" });
  const bottom = await insertWardrobeItem(admin, userId, {
    layer_role: "bottom",
    category: "bottoms",
  });
  return { top, bottom };
}

export function snapshotItems(userId: string, topId: string, bottomId: string) {
  return [
    {
      item_id: topId,
      role: "top",
      sort_order: 0,
      cutout_bucket_id: "wardrobe-items",
      cutout_storage_path: `${userId}/${topId}/cutout.png`,
      cutout_sha256: sha("b"),
    },
    {
      item_id: bottomId,
      role: "bottom",
      sort_order: 1,
      cutout_bucket_id: "wardrobe-items",
      cutout_storage_path: `${userId}/${bottomId}/cutout.png`,
      cutout_sha256: sha("c"),
    },
  ];
}

export const GENERATION_CONFIG = {
  p_prompt_version: "outfit-visualization@v2",
  p_provider: "fake",
  p_model_key: "fake-visualization-ready",
  p_capability_version: "auto_fidelity@1",
  p_output_size: "1024x1536",
  p_output_quality: "high",
  p_qa_version: "visualization-qa@v1",
  p_localization_version: "garment-hotspots@v1",
};
