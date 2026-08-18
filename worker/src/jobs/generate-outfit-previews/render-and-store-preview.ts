import { generateModeledPreview } from "@/lib/ai/image-service";
import { downloadPrivateObject } from "@/lib/storage/private-images";
import {
  MissingCutoutError,
  type AdminClient,
  type CandidateMemberRow,
  type OutfitPreviewJobRow,
  type ServerEnvironment,
} from "./contracts";
import { randomUUID } from "node:crypto";
import { uploadPrivateObject } from "@/lib/storage/private-images";

async function storePreview(
  admin: AdminClient,
  environment: ServerEnvironment,
  job: OutfitPreviewJobRow,
  previewBytes: Buffer,
) {
  const path = `${job.user_id}/${job.candidate_id}/preview-${randomUUID()}.png`;
  await uploadPrivateObject(
    admin,
    environment.WARDROBE_GENERATED_BUCKET,
    path,
    job.user_id,
    previewBytes,
    "image/png",
  );
  await admin.rpc("finalize_outfit_preview_job", {
    p_job_id: job.id,
    p_user_id: job.user_id,
    p_bucket: environment.WARDROBE_GENERATED_BUCKET,
    p_storage_path: path,
    p_source_hash: job.source_hash,
    p_model: environment.AI_IMAGE_POLICY_VERSION,
  });
}

async function loadPrimaryCutout(
  admin: AdminClient,
  userId: string,
  itemId: string,
): Promise<Buffer> {
  const { data } = await admin
    .from("wardrobe_item_images")
    .select("bucket_id, storage_path")
    .eq("user_id", userId)
    .eq("item_id", itemId)
    .eq("kind", "cutout")
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) throw new MissingCutoutError(itemId);
  return downloadPrivateObject(
    admin,
    data.bucket_id as string,
    data.storage_path as string,
    userId,
  );
}

async function buildPreviewPromptInput(
  admin: AdminClient,
  memberRows: CandidateMemberRow[],
  userId: string,
) {
  const { data: itemRows } = await admin
    .from("wardrobe_items")
    .select("id, category, color_names, pattern")
    .eq("user_id", userId)
    .in(
      "id",
      memberRows.map((member) => member.item_id),
    );
  const itemsById = new Map((itemRows ?? []).map((row) => [row.id as string, row]));

  return memberRows.map((member) => {
    const item = itemsById.get(member.item_id);
    return {
      role: member.role,
      category: (item?.category as string | undefined) ?? "garment",
      colorNames: (item?.color_names as string[] | undefined) ?? [],
      pattern: (item?.pattern as string | null | undefined) ?? null,
    };
  });
}

export async function renderAndStorePreview(
  admin: AdminClient,
  environment: ServerEnvironment,
  job: OutfitPreviewJobRow,
  memberRows: CandidateMemberRow[],
  identityReferencePath: string,
) {
  const identityReference = await downloadPrivateObject(
    admin,
    environment.PROFILE_REFERENCES_BUCKET,
    identityReferencePath,
    job.user_id,
  );
  const garmentCutouts = await Promise.all(
    memberRows.map((member) => loadPrimaryCutout(admin, job.user_id, member.item_id)),
  );
  const items = await buildPreviewPromptInput(admin, memberRows, job.user_id);
  const previewBytes = await generateModeledPreview({
    userId: job.user_id,
    identityReference,
    garmentCutouts,
    items,
  });

  await storePreview(admin, environment, job, previewBytes);
}
