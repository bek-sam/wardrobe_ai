import { randomUUID } from "node:crypto";

import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { finishCompilation } from "./finish-compilation";
import { generateOrReuseCandidates } from "./generate-or-reuse-candidates";
import { handleCompilationFailure } from "./handle-compilation-failure";
import { loadCompilationInputs } from "./load-compilation-inputs";
import { loadJob } from "./load-job";

export async function compileWardrobeForUser(userId: string, jobId: string) {
  const admin = createAdminClient();
  const job = await loadJob(admin, jobId);
  if (job.user_id !== userId) {
    throw new Error("Wardrobe compilation job does not belong to this user.");
  }

  let compiledWardrobeVersion: string = randomUUID();
  let isNewVersion = true;
  try {
    const { initialState, startChangeCount, items, preferences, changeEvents } =
      await loadCompilationInputs(admin, userId);
    const environment = getServerEnvironment();

    const generated = await generateOrReuseCandidates(
      admin,
      userId,
      jobId,
      items,
      preferences,
      environment,
      changeEvents,
      initialState,
      compiledWardrobeVersion,
    );
    compiledWardrobeVersion = generated.compiledWardrobeVersion;
    isNewVersion = generated.isNewVersion;

    return await finishCompilation(
      admin,
      userId,
      jobId,
      environment,
      compiledWardrobeVersion,
      generated.candidateCount,
      items,
      preferences,
      startChangeCount,
      changeEvents,
    );
  } catch (error) {
    await handleCompilationFailure(admin, job, compiledWardrobeVersion, isNewVersion, error);
    throw error;
  }
}
