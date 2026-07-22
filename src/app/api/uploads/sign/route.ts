import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { signUploadSchema, type UploadPurpose } from "@/features/uploads/schemas";
import { parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/viewer";
import { getServerEnvironment } from "@/lib/env/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function bucketForPurpose(purpose: UploadPurpose) {
  const environment = getServerEnvironment();
  return {
    "wardrobe-original": environment.WARDROBE_ORIGINALS_BUCKET,
    "wardrobe-item": environment.WARDROBE_ITEMS_BUCKET,
    "wardrobe-label": environment.WARDROBE_LABELS_BUCKET,
    "profile-reference": environment.PROFILE_REFERENCES_BUCKET,
  }[purpose];
}

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

export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [viewer, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, signUploadSchema),
      createClient(),
    ]);
    const bucket = bucketForPurpose(input.purpose);
    const path = `${viewer.id}/${randomUUID()}/${safeFileName(input.fileName, input.contentType)}`;
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;

    return NextResponse.json(
      {
        data: {
          bucket,
          path: data.path,
          signedUrl: data.signedUrl,
          token: data.token,
          expiresInSeconds: 7_200,
          requiredContentType: input.contentType,
          maximumFileSize: 20 * 1024 * 1024,
        },
      },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return routeError(error);
  }
}
