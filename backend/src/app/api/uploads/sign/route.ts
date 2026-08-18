import { NextResponse } from "next/server";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getServerEnvironment } from "@/lib/env/server";

const uploadPurposeSchema = z.enum([
  "wardrobe-original",
  "wardrobe-item",
  "wardrobe-label",
  "profile-reference",
]);

const signUploadSchema = z
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

type UploadPurpose = z.infer<typeof uploadPurposeSchema>;

function safeFileName(fileName: string, contentType: string) {
  const base = fileName
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  const expectedExtension = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[contentType];
  const stem = (base || "upload").replace(/\.[^.]+$/, "");
  return `${stem}.${expectedExtension}`;
}

function bucketForPurpose(purpose: UploadPurpose) {
  const environment = getServerEnvironment();
  return {
    "wardrobe-original": environment.WARDROBE_ORIGINALS_BUCKET,
    "wardrobe-item": environment.WARDROBE_ITEMS_BUCKET,
    "wardrobe-label": environment.WARDROBE_LABELS_BUCKET,
    "profile-reference": environment.PROFILE_REFERENCES_BUCKET,
  }[purpose];
}

type SignUploadInput = z.infer<typeof signUploadSchema>;

async function handleSignUpload(supabase: SupabaseClient, userId: string, input: SignUploadInput) {
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

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, signUploadSchema),
      createClient(),
    ]);

    const data = await handleSignUpload(supabase, viewer.id, input);
    return NextResponse.json(
      { data },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
