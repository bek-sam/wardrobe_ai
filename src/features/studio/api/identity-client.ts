import { requestJson } from "@/lib/api/request";

import type { IdentityState } from "../types";

export function fetchIdentityState(signal?: AbortSignal) {
  return requestJson<IdentityState>("/api/identity-references", { signal });
}

type SignedUpload = { bucket: string; path: string; signedUrl: string; token: string };

/**
 * Two-step, like every other image path in the app: the server allocates a
 * user-scoped destination, the browser uploads straight to private storage,
 * and only then does a confirmation call ask the server to read, validate,
 * normalize, and store the canonical copy.
 */
export async function uploadIdentityPhoto(file: File) {
  const signed = await requestJson<SignedUpload>("/api/uploads/sign", {
    method: "POST",
    body: JSON.stringify({
      purpose: "profile-reference",
      fileName: file.name,
      contentType: file.type,
    }),
  });

  const upload = await fetch(signed.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type, "x-upsert": "false" },
    body: file,
  });
  if (!upload.ok) throw new Error("The photo could not be uploaded.");

  return requestJson<{ reference: { id: string }; assessment: { userMessage: string } }>(
    "/api/identity-references",
    { method: "POST", body: JSON.stringify({ storagePath: signed.path }) },
  );
}

export function activateIdentityReference(referenceId: string) {
  return requestJson<{ consentVersion: string }>("/api/identity-references/activate", {
    method: "POST",
    body: JSON.stringify({ referenceId, consentAccepted: true }),
  });
}

export function revokeIdentityReference(deleteAssets: boolean) {
  return requestJson<unknown>("/api/identity-references/revoke", {
    method: "POST",
    body: JSON.stringify({ deleteAssets }),
  });
}
