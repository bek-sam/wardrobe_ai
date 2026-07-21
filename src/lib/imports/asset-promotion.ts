import { z } from "zod";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  assertOwnedStoragePath,
  downloadPrivateObject,
  uploadPrivateObject,
} from "@/lib/storage/private-images";

const promotableAssetKindSchema = z.enum(["crop", "cutout", "modeled"]);
const imageMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const assetMetadataSchema = z.object({
  mime_type: imageMimeTypeSchema,
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  file_size: z.coerce.number().int().positive(),
});

const importJobSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.literal("complete"),
  original_image_bucket: z.string().min(1),
  original_image_path: z.string().min(1),
});

const confirmedCandidateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  job_id: z.string().uuid(),
  wardrobe_item_id: z.string().uuid(),
  crop_storage_path: z.string().min(1).nullable(),
  crop_asset_metadata: assetMetadataSchema.nullable(),
  cutout_storage_path: z.string().min(1),
  cutout_asset_metadata: assetMetadataSchema,
  modeled_storage_path: z.string().min(1).nullable(),
  modeled_asset_metadata: assetMetadataSchema.nullable(),
});

const wardrobeItemSchema = z.object({ id: z.string().uuid() });

const imageRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  item_id: z.string().uuid(),
  kind: z.enum(["original", "crop", "cutout", "modeled"]),
  bucket_id: z.string().min(1),
  storage_path: z.string().min(1),
});

const uuidSchema = z.string().uuid();

export type PromotableAssetKind = z.infer<typeof promotableAssetKindSchema>;
type AssetMetadata = z.infer<typeof assetMetadataSchema>;
type ConfirmedCandidate = z.infer<typeof confirmedCandidateSchema>;
type ImageRow = z.infer<typeof imageRowSchema>;

export type ImportAssetPromotionPlan = {
  candidateId: string;
  itemId: string;
  kind: PromotableAssetKind;
  contentType: z.infer<typeof imageMimeTypeSchema>;
  source: {
    bucket: string;
    path: string;
  };
  destination: {
    bucket: string;
    path: string;
  };
};

export type ConfirmedImportCandidateAssets = {
  candidateId: string;
  itemId: string;
  crop: { path: string; metadata: AssetMetadata } | null;
  cutout: { path: string; metadata: AssetMetadata };
  modeled: { path: string; metadata: AssetMetadata } | null;
};

export type ImportAssetPromotionBuckets = {
  originals: string;
  items: string;
  generated: string;
};

const mimeTypeExtensions: Record<z.infer<typeof imageMimeTypeSchema>, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};

function requireUuid(value: string, label: string) {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) throw new Error(`${label} must be a UUID.`);
  return parsed.data;
}

export function buildPromotedImportAssetPath(input: {
  userId: string;
  itemId: string;
  candidateId: string;
  kind: PromotableAssetKind;
  contentType: z.infer<typeof imageMimeTypeSchema>;
}) {
  const userId = requireUuid(input.userId, "User ID");
  const itemId = requireUuid(input.itemId, "Item ID");
  const candidateId = requireUuid(input.candidateId, "Candidate ID");
  const kind = promotableAssetKindSchema.parse(input.kind);
  const contentType = imageMimeTypeSchema.parse(input.contentType);
  const extension = mimeTypeExtensions[contentType];
  const destination = `${userId}/${itemId}/${kind}/${candidateId}.${extension}`;
  assertOwnedStoragePath(destination, userId);
  return destination;
}

function planAsset(input: {
  userId: string;
  candidateId: string;
  itemId: string;
  kind: PromotableAssetKind;
  sourceBucket: string;
  destinationBucket: string;
  asset: { path: string; metadata: AssetMetadata };
}): ImportAssetPromotionPlan {
  assertOwnedStoragePath(input.asset.path, input.userId);
  return {
    candidateId: input.candidateId,
    itemId: input.itemId,
    kind: input.kind,
    contentType: input.asset.metadata.mime_type,
    source: { bucket: input.sourceBucket, path: input.asset.path },
    destination: {
      bucket: input.destinationBucket,
      path: buildPromotedImportAssetPath({
        userId: input.userId,
        itemId: input.itemId,
        candidateId: input.candidateId,
        kind: input.kind,
        contentType: input.asset.metadata.mime_type,
      }),
    },
  };
}

export function planConfirmedImportAssetPromotions(input: {
  userId: string;
  candidates: ConfirmedImportCandidateAssets[];
  buckets: ImportAssetPromotionBuckets;
}): ImportAssetPromotionPlan[] {
  requireUuid(input.userId, "User ID");
  const plans: ImportAssetPromotionPlan[] = [];

  for (const candidate of input.candidates) {
    requireUuid(candidate.candidateId, "Candidate ID");
    requireUuid(candidate.itemId, "Item ID");

    if (candidate.crop) {
      plans.push(
        planAsset({
          userId: input.userId,
          candidateId: candidate.candidateId,
          itemId: candidate.itemId,
          kind: "crop",
          sourceBucket: input.buckets.originals,
          destinationBucket: input.buckets.items,
          asset: candidate.crop,
        }),
      );
    }

    plans.push(
      planAsset({
        userId: input.userId,
        candidateId: candidate.candidateId,
        itemId: candidate.itemId,
        kind: "cutout",
        sourceBucket: input.buckets.generated,
        destinationBucket: input.buckets.generated,
        asset: candidate.cutout,
      }),
    );

    if (candidate.modeled) {
      plans.push(
        planAsset({
          userId: input.userId,
          candidateId: candidate.candidateId,
          itemId: candidate.itemId,
          kind: "modeled",
          sourceBucket: input.buckets.generated,
          destinationBucket: input.buckets.generated,
          asset: candidate.modeled,
        }),
      );
    }
  }

  return plans;
}

function candidateAssets(candidate: ConfirmedCandidate): ConfirmedImportCandidateAssets {
  if (candidate.crop_storage_path && !candidate.crop_asset_metadata) {
    throw new Error("A confirmed crop is missing asset metadata.");
  }
  if (candidate.modeled_storage_path && !candidate.modeled_asset_metadata) {
    throw new Error("A confirmed modeled image is missing asset metadata.");
  }

  return {
    candidateId: candidate.id,
    itemId: candidate.wardrobe_item_id,
    crop:
      candidate.crop_storage_path && candidate.crop_asset_metadata
        ? { path: candidate.crop_storage_path, metadata: candidate.crop_asset_metadata }
        : null,
    cutout: {
      path: candidate.cutout_storage_path,
      metadata: candidate.cutout_asset_metadata,
    },
    modeled:
      candidate.modeled_storage_path && candidate.modeled_asset_metadata
        ? { path: candidate.modeled_storage_path, metadata: candidate.modeled_asset_metadata }
        : null,
  };
}

function sameStringSet(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const rightValues = new Set(right);
  return rightValues.size === right.length && left.every((value) => rightValues.has(value));
}

function resolveImageRow(plan: ImportAssetPromotionPlan, imageRows: ImageRow[]) {
  const matches = imageRows.filter(
    (row) =>
      row.item_id === plan.itemId &&
      row.kind === plan.kind &&
      (row.storage_path === plan.source.path || row.storage_path === plan.destination.path),
  );
  if (matches.length !== 1) {
    throw new Error(`Expected one ${plan.kind} image row for confirmed item ${plan.itemId}.`);
  }
  return matches[0]!;
}

async function copyPlan(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  plan: ImportAssetPromotionPlan,
) {
  const bytes = await downloadPrivateObject(admin, plan.source.bucket, plan.source.path, userId);
  await uploadPrivateObject(
    admin,
    plan.destination.bucket,
    plan.destination.path,
    userId,
    bytes,
    plan.contentType,
  );
}

async function updateImageRow(
  admin: ReturnType<typeof createAdminClient>,
  row: ImageRow,
  plan: ImportAssetPromotionPlan,
) {
  if (row.bucket_id === plan.destination.bucket && row.storage_path === plan.destination.path) {
    return false;
  }

  const { data, error } = await admin
    .from("wardrobe_item_images")
    .update({
      bucket_id: plan.destination.bucket,
      storage_path: plan.destination.path,
    })
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .eq("item_id", row.item_id)
    .eq("bucket_id", row.bucket_id)
    .eq("storage_path", row.storage_path)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data) return true;

  // A concurrent retry may have completed the exact same promotion.
  const { data: current, error: currentError } = await admin
    .from("wardrobe_item_images")
    .select("bucket_id, storage_path")
    .eq("id", row.id)
    .eq("user_id", row.user_id)
    .eq("item_id", row.item_id)
    .maybeSingle();
  if (currentError) throw currentError;
  if (
    current?.bucket_id === plan.destination.bucket &&
    current.storage_path === plan.destination.path
  ) {
    return false;
  }
  throw new Error("The confirmed image row changed during asset promotion.");
}

/**
 * Copies job-scoped candidate assets into stable item-scoped locations.
 * Candidate paths and the shared original are deliberately left untouched so
 * a failed or repeated confirmation can replay this operation safely.
 */
export async function promoteConfirmedImportAssets(input: {
  userId: string;
  jobId: string;
  itemIds: string[];
}) {
  const userId = requireUuid(input.userId, "User ID");
  const jobId = requireUuid(input.jobId, "Import job ID");
  const itemIds = input.itemIds.map((itemId) => requireUuid(itemId, "Item ID"));
  if (itemIds.length === 0 || new Set(itemIds).size !== itemIds.length) {
    throw new Error("Confirmed item IDs must be a non-empty unique list.");
  }

  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const [jobResult, candidateResult, itemResult, imageResult] = await Promise.all([
    admin
      .from("import_jobs")
      .select("id, user_id, status, original_image_bucket, original_image_path")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle(),
    admin
      .from("import_job_candidates")
      .select(
        "id, user_id, job_id, wardrobe_item_id, crop_storage_path, crop_asset_metadata, cutout_storage_path, cutout_asset_metadata, modeled_storage_path, modeled_asset_metadata",
      )
      .eq("job_id", jobId)
      .eq("user_id", userId)
      .in("wardrobe_item_id", itemIds),
    admin.from("wardrobe_items").select("id").eq("user_id", userId).in("id", itemIds),
    admin
      .from("wardrobe_item_images")
      .select("id, user_id, item_id, kind, bucket_id, storage_path")
      .eq("user_id", userId)
      .in("item_id", itemIds)
      .in("kind", ["original", "crop", "cutout", "modeled"]),
  ]);

  if (jobResult.error || candidateResult.error || itemResult.error || imageResult.error) {
    throw new Error("Could not load confirmed import assets.", {
      cause: jobResult.error ?? candidateResult.error ?? itemResult.error ?? imageResult.error,
    });
  }
  if (!jobResult.data) throw new Error("The confirmed import job was not found for this user.");

  const job = importJobSchema.parse(jobResult.data);
  const candidates = z.array(confirmedCandidateSchema).parse(candidateResult.data ?? []);
  const ownedItems = z.array(wardrobeItemSchema).parse(itemResult.data ?? []);
  const imageRows = z.array(imageRowSchema).parse(imageResult.data ?? []);

  if (
    !sameStringSet(
      itemIds,
      candidates.map((candidate) => candidate.wardrobe_item_id),
    )
  ) {
    throw new Error("Confirmed candidates do not match the returned item IDs.");
  }
  if (
    !sameStringSet(
      itemIds,
      ownedItems.map((item) => item.id),
    )
  ) {
    throw new Error("One or more confirmed items do not belong to the authenticated user.");
  }

  for (const itemId of itemIds) {
    const originalRows = imageRows.filter(
      (row) =>
        row.item_id === itemId &&
        row.kind === "original" &&
        row.bucket_id === job.original_image_bucket &&
        row.storage_path === job.original_image_path,
    );
    if (originalRows.length !== 1) {
      throw new Error(`The shared original-image lineage is missing for item ${itemId}.`);
    }
  }

  const plans = planConfirmedImportAssetPromotions({
    userId,
    candidates: candidates.map(candidateAssets),
    buckets: {
      originals: environment.WARDROBE_ORIGINALS_BUCKET,
      items: environment.WARDROBE_ITEMS_BUCKET,
      generated: environment.WARDROBE_GENERATED_BUCKET,
    },
  });
  const plansWithRows = plans.map((plan) => ({
    plan,
    row: resolveImageRow(plan, imageRows),
  }));

  // Finish all copy attempts before changing any database path. Successful
  // copies may be replayed with upsert=true if another copy fails.
  const copyResults = await Promise.allSettled(
    plansWithRows.map(({ plan }) => copyPlan(admin, userId, plan)),
  );
  const copyFailure = copyResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (copyFailure) {
    throw new Error("One or more confirmed assets could not be copied.", {
      cause: copyFailure.reason,
    });
  }

  const updateResults = await Promise.allSettled(
    plansWithRows.map(({ row, plan }) => updateImageRow(admin, row, plan)),
  );
  const updateFailure = updateResults.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );
  if (updateFailure) {
    throw new Error("One or more confirmed image rows could not be promoted.", {
      cause: updateFailure.reason,
    });
  }

  return {
    copiedAssetCount: plans.length,
    updatedImageCount: updateResults.filter(
      (result): result is PromiseFulfilledResult<true> =>
        result.status === "fulfilled" && result.value,
    ).length,
  };
}
