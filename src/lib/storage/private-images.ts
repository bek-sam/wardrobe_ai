import type { SupabaseClient } from "@supabase/supabase-js";

export function assertOwnedStoragePath(path: string, userId: string) {
  if (!path.startsWith(`${userId}/`) || path.includes("..") || path.includes("\\")) {
    throw new Error("The storage path does not belong to the authenticated user.");
  }
}

export async function downloadPrivateObject(
  client: SupabaseClient,
  bucket: string,
  path: string,
  userId: string,
): Promise<Buffer> {
  assertOwnedStoragePath(path, userId);
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadPrivateObject(
  client: SupabaseClient,
  bucket: string,
  path: string,
  userId: string,
  bytes: Buffer,
  contentType: string,
) {
  assertOwnedStoragePath(path, userId);
  const { error } = await client.storage.from(bucket).upload(path, bytes, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw error;
  return { bucket, path };
}

export async function createPrivateSignedUrl(
  client: SupabaseClient,
  bucket: string,
  path: string,
  userId: string,
  expiresIn: number,
) {
  assertOwnedStoragePath(path, userId);
  const { data, error } = await client.storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
