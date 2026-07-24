import type { z } from "zod";

import { ApiError } from "@/lib/api/response";

import type { profileUpdateSchema } from "../_lib/schemas";

type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

export function validateOwnedPaths(userId: string, input: ProfileUpdateInput) {
  if (input.avatar_path && !input.avatar_path.startsWith(`${userId}/`)) {
    throw new ApiError(
      422,
      "validation_failed",
      "The avatar path must belong to the authenticated user.",
    );
  }
  if (input.identity_reference_path && !input.identity_reference_path.startsWith(`${userId}/`)) {
    throw new ApiError(
      422,
      "validation_failed",
      "The identity reference path must belong to the authenticated user.",
    );
  }
}
