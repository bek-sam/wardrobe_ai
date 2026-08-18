import { requestJson } from "@/lib/api/request";
import type { IdentityState } from "../types";
import type { WardrobeItemRole } from "@/features/wardrobe";
import type { StudioVariantsResponse } from "../types";
import type { StudioVisualization } from "../types";

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

export type SwapCandidate = {
  id: string;
  name: string;
  layer_role: WardrobeItemRole | null;
  category: string;
  subcategory: string | null;
};

export function setItemFavorite(itemId: string, favorite: boolean) {
  return requestJson<unknown>(`/api/items/${itemId}/favorite`, {
    method: "POST",
    body: JSON.stringify({ favorite }),
  });
}

export function markItemWorn(itemId: string) {
  return requestJson<unknown>(`/api/items/${itemId}/mark-worn`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/**
 * Available owned items. The list route filters availability and status
 * server-side; role is resolved client-side with the same shared helper the
 * server uses, and every mutation re-checks it before writing anything.
 */
export function fetchAvailableItems() {
  const query = new URLSearchParams({
    availability: "available",
    status: "active",
    limit: "100",
  });
  return requestJson<{ items: SwapCandidate[] }>(`/api/items?${query.toString()}`);
}

export type StudioRequestInput = {
  message: string;
  date: string;
  location: string | null;
  occasion: string | null;
  indoorOutdoor: "indoor" | "outdoor" | "mixed" | null;
  lockedItemIds: string[];
};

export function fetchOutfitVariants(input: StudioRequestInput, signal?: AbortSignal) {
  return requestJson<StudioVariantsResponse>("/api/outfits/variants", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
}

export function fetchItemCutouts(itemIds: readonly string[], signal?: AbortSignal) {
  return requestJson<{ cutouts: { itemId: string; url: string }[] }>("/api/items/cutouts", {
    method: "POST",
    body: JSON.stringify({ itemIds }),
    signal,
  });
}

export type VisualizationOutcome = {
  outcome:
    | "created"
    | "reused"
    | "already_fresh"
    | "queue_full"
    | "quota_exhausted"
    | "conflict"
    | "needs_identity"
    | "needs_consent";
  visualizationId?: string;
  status?: string;
  consentVersion?: string;
  resetAt?: string | null;
  reason?: string;
  pollAfterMs: number;
};

export type SnapshotSelection = { item_id: string; role: string; sort_order: number };

export function createVisualization(items: readonly SnapshotSelection[]) {
  return requestJson<VisualizationOutcome>("/api/outfit-visualizations", {
    method: "POST",
    body: JSON.stringify({ sourceKind: "composition", items }),
  });
}

export function fetchVisualization(visualizationId: string, signal?: AbortSignal) {
  return requestJson<StudioVisualization>(`/api/outfit-visualizations/${visualizationId}`, {
    signal,
  });
}

export function regenerateVisualization(visualizationId: string) {
  return requestJson<VisualizationOutcome>(
    `/api/outfit-visualizations/${visualizationId}/regenerate`,
    { method: "POST" },
  );
}

/** No-op unless the deployment enables inline processing; used in dev and E2E. */
export function processVisualizationInline(visualizationId: string) {
  return requestJson<unknown>(`/api/outfit-visualizations/${visualizationId}/process`, {
    method: "POST",
  }).catch(() => null);
}

export function submitFeedback(visualizationId: string, reason: string, comment: string | null) {
  return requestJson<unknown>(`/api/outfit-visualizations/${visualizationId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ reason, comment }),
  });
}
