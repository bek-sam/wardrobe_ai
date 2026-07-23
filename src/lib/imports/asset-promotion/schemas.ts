import { z } from "zod";

export const promotableAssetKindSchema = z.enum(["crop", "cutout", "modeled"]);

export const imageMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const assetMetadataSchema = z.object({
  mime_type: imageMimeTypeSchema,
  width: z.coerce.number().int().positive(),
  height: z.coerce.number().int().positive(),
  file_size: z.coerce.number().int().positive(),
});

export const importJobSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: z.literal("complete"),
  original_image_bucket: z.string().min(1),
  original_image_path: z.string().min(1),
});

export const confirmedCandidateSchema = z.object({
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

export const wardrobeItemSchema = z.object({ id: z.string().uuid() });

export const imageRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  item_id: z.string().uuid(),
  kind: z.enum(["original", "crop", "cutout", "modeled"]),
  bucket_id: z.string().min(1),
  storage_path: z.string().min(1),
});

export const uuidSchema = z.string().uuid();

export type PromotableAssetKind = z.infer<typeof promotableAssetKindSchema>;
export type AssetMetadata = z.infer<typeof assetMetadataSchema>;
export type ConfirmedCandidate = z.infer<typeof confirmedCandidateSchema>;
export type ImageRow = z.infer<typeof imageRowSchema>;
export type ImageMimeType = z.infer<typeof imageMimeTypeSchema>;
export type ImportJob = z.infer<typeof importJobSchema>;
