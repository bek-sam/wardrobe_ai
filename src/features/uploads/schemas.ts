import { z } from "zod";

export const uploadPurposeSchema = z.enum([
  "wardrobe-original",
  "wardrobe-item",
  "wardrobe-label",
  "profile-reference",
]);

export const signUploadSchema = z
  .object({
    purpose: uploadPurposeSchema,
    fileName: z.string().min(1).max(180),
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    fileSize: z
      .number()
      .int()
      .positive()
      .max(20 * 1024 * 1024),
  })
  .strict();

export type UploadPurpose = z.infer<typeof uploadPurposeSchema>;
