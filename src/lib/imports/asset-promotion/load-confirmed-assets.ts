import { z } from "zod";

import type { createAdminClient } from "@/lib/supabase/admin";

import {
  confirmedCandidateSchema,
  imageRowSchema,
  importJobSchema,
  wardrobeItemSchema,
} from "./schemas";
import { queryConfirmedAssets } from "./query-confirmed-assets";
import { verifyConfirmedAssets } from "./verify-confirmed-assets";

export async function loadConfirmedAssets(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  jobId: string,
  itemIds: string[],
) {
  const [jobResult, candidateResult, itemResult, imageResult] = await queryConfirmedAssets(
    admin,
    userId,
    jobId,
    itemIds,
  );

  if (jobResult.error || candidateResult.error || itemResult.error || imageResult.error) {
    throw new Error("Could not load confirmed import assets.", {
      cause: jobResult.error ?? candidateResult.error ?? itemResult.error ?? imageResult.error,
    });
  }
  if (!jobResult.data) throw new Error("The confirmed import job was not found for this user.");

  const job = importJobSchema.parse(jobResult.data);
  const candidates = z.array(confirmedCandidateSchema).parse(candidateResult.data ?? []);
  const ownedItems = z.array(wardrobeItemSchema).parse(itemResult.data ?? []);
  const imageRows = z.array(imageRowSchema).parse(imageResult.data ?? []);

  verifyConfirmedAssets({ itemIds, candidates, ownedItems, imageRows, job });

  return { job, candidates, imageRows };
}
