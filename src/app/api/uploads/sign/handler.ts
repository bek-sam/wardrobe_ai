import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";

import type { signUploadSchema } from "@/features/uploads/schemas";

import { bucketForPurpose } from "./bucket-for-purpose";
import { safeFileName } from "./safe-file-name";

type SignUploadInput = z.infer<typeof signUploadSchema>;

export async function handleSignUpload(
  supabase: SupabaseClient,
  userId: string,
  input: SignUploadInput,
) {
  const bucket = bucketForPurpose(input.purpose);
  const path = `${userId}/${randomUUID()}/${safeFileName(input.fileName, input.contentType)}`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { upsert: false });
  if (error) throw error;

  return {
    bucket,
    path: data.path,
    signedUrl: data.signedUrl,
    token: data.token,
    expiresInSeconds: 7_200,
    requiredContentType: input.contentType,
    maximumFileSize: 20 * 1024 * 1024,
  };
}
