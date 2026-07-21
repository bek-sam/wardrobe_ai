import { accountDeletionManifestSchema, accountDeletionSchema } from "@/app/api/_lib/schemas";
import { throwDatabaseError } from "@/app/api/_lib/route";
import { ApiError, ok, parseJson, routeError } from "@/lib/api/response";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const STORAGE_DELETE_BATCH_SIZE = 100;

export async function DELETE(request: Request) {
  try {
    const viewer = await requireViewer();
    const input = await parseJson(request, accountDeletionSchema);
    if (input.confirmation !== viewer.id) {
      throw new ApiError(
        422,
        "confirmation_mismatch",
        "Account deletion confirmation must match the authenticated user ID.",
      );
    }

    const supabase = await createClient();
    const { data: rawManifest, error: manifestError } = await supabase.rpc(
      "account_deletion_manifest",
    );
    throwDatabaseError(manifestError, "Could not prepare account deletion.");
    const parsedManifest = accountDeletionManifestSchema.safeParse(rawManifest);
    if (!parsedManifest.success || parsedManifest.data.user_id !== viewer.id) {
      throw new ApiError(500, "deletion_manifest_invalid", "Could not prepare account deletion.");
    }

    const admin = createAdminClient();
    const objectsByBucket = new Map<string, string[]>();
    for (const object of parsedManifest.data.storage_objects) {
      const paths = objectsByBucket.get(object.bucket_id) ?? [];
      paths.push(object.name);
      objectsByBucket.set(object.bucket_id, paths);
    }

    for (const [bucket, paths] of objectsByBucket) {
      for (let index = 0; index < paths.length; index += STORAGE_DELETE_BATCH_SIZE) {
        const batch = paths.slice(index, index + STORAGE_DELETE_BATCH_SIZE);
        const { error } = await admin.storage.from(bucket).remove(batch);
        if (error) {
          throw new ApiError(
            500,
            "storage_deletion_failed",
            "Could not delete private account files.",
          );
        }
      }
    }

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(viewer.id);
    if (deleteUserError) {
      throw new ApiError(500, "account_deletion_failed", "Could not delete the account.");
    }

    await supabase.auth.signOut({ scope: "local" });

    return ok({ deleted: true, user_id: viewer.id });
  } catch (error) {
    return routeError(error);
  }
}
