import { activateIdentityReferenceSchema, TRYON_CONSENT_VERSION } from "@/lib/visualization";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { rejectUntrustedOrigin } from "@/lib/api/origin";
import { requireViewer } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Activation is the moment consent is recorded, and it needs an explicit
 * `consentAccepted: true` in the body — a passive link or an implicit upload
 * is not consent. The consent version is taken from the server constant, never
 * from the request, so a client cannot claim acceptance of a version that does
 * not exist.
 */
export async function POST(request: Request) {
  try {
    const rejected = rejectUntrustedOrigin(request);
    if (rejected) return rejected;
    const [, input, supabase] = await Promise.all([
      requireViewer(),
      parseJson(request, activateIdentityReferenceSchema),
      createClient(),
    ]);

    const { data, error } = await supabase.rpc("activate_identity_reference", {
      p_reference_id: input.referenceId,
      p_consent_version: TRYON_CONSENT_VERSION,
    });
    if (error?.code === "PT404") {
      throw new ApiError(404, "not_found", "That reference photo was not found.");
    }
    if (error?.code === "22023") {
      throw new ApiError(
        422,
        "identity_not_validated",
        "That photo did not pass the reference check. Upload a different one.",
      );
    }
    if (error) throw error;
    // The RPC returns the whole row; only the safe fields go to the browser.
    // The GET handler strips storage_path deliberately, and handing it back
    // here would undo that for no benefit.
    const row = data as { id: string; validation_status: string; consented_at: string } | null;
    return ok(
      {
        reference: row && {
          id: row.id,
          validation_status: row.validation_status,
          consented_at: row.consented_at,
        },
        consentVersion: TRYON_CONSENT_VERSION,
      },
      { status: 200 },
    );
  } catch (error) {
    return routeError(error);
  }
}
