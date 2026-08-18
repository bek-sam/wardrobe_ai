import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

export async function imageAssetMetadata(bytes: Buffer) {
  const metadata = await sharp(bytes).metadata();
  if (!metadata.width || !metadata.height) throw new Error("Generated image metadata is invalid.");
  return {
    mime_type: "image/png",
    width: metadata.width,
    height: metadata.height,
    file_size: bytes.byteLength,
  };
}

export function excludeTerminalJobStatuses<
  Q extends { not: (column: string, operator: string, value: string) => Q },
>(query: Q): Q {
  return query.not("status", "in", "(complete,cancelled)");
}

export async function requireOwnedImportJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
) {
  const { data, error } = await supabase
    .from("import_jobs")
    .select("id,status")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
