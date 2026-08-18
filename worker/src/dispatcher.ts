import { compileWardrobeForUser } from "@/jobs/compile-wardrobe";
import {
  enqueueScheduledPreviewJobs,
  processOutfitPreviewBatch,
} from "@/jobs/generate-outfit-previews";
import { processVisualizationBatch } from "@/jobs/generate-outfit-visualizations";
import { processImportJob } from "@/jobs/process-import/process-job";
import { processResearchRun } from "@/jobs/research-item";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { processStorageDeletionBatch } from "./handlers/storage-deletion.js";

export const WORKER_FAMILIES = [
  "storage-deletion",
  "import",
  "research",
  "wardrobe-compilation",
  "outfit-preview",
  "outfit-visualization",
] as const;

type WorkerFamily = (typeof WORKER_FAMILIES)[number];

function claimedId(value: unknown): string | null {
  const claimed = Array.isArray(value) ? value[0] : value;
  if (typeof claimed === "string") return claimed;
  if (claimed && typeof claimed === "object" && "id" in claimed && typeof claimed.id === "string") {
    return claimed.id;
  }
  return null;
}

async function processOneImport(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_import_job", { p_lease_seconds: 300 });
  if (error) throw error;
  const id = claimedId(data);
  if (!id) return 0;
  await processImportJob(id);
  return 1;
}

async function processOneResearch(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_research_job", { p_lease_seconds: 300 });
  if (error) throw error;
  const id = claimedId(data);
  if (!id) return 0;
  await processResearchRun(id);
  return 1;
}

async function processOneCompilation(): Promise<number> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_wardrobe_compilation_jobs", {
    p_limit: 1,
    p_lease_seconds: 300,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as
    { id?: unknown; user_id?: unknown } | null | undefined;
  if (typeof row?.id !== "string" || typeof row.user_id !== "string") return 0;
  await compileWardrobeForUser(row.user_id, row.id);
  return 1;
}

let lastPreviewSweepAt = 0;
async function processPreviews(): Promise<number> {
  const now = Date.now();
  if (now - lastPreviewSweepAt >= 60 * 60 * 1_000) {
    lastPreviewSweepAt = now;
    await enqueueScheduledPreviewJobs(createAdminClient(), getServerEnvironment()).catch(() => {});
  }
  const result = await processOutfitPreviewBatch(now, 240_000);
  return result.claimed;
}

async function processVisualizations(): Promise<number> {
  const result = await processVisualizationBatch(Date.now(), 240_000);
  return result.claimed;
}

function enabledFamilies(environment: NodeJS.ProcessEnv): WorkerFamily[] {
  const configured = environment.WORKER_ENABLED_FAMILIES?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!configured?.length) return [...WORKER_FAMILIES];
  const allowed = new Set(WORKER_FAMILIES);
  const invalid = configured.filter((value) => !allowed.has(value as WorkerFamily));
  if (invalid.length > 0) throw new Error(`Unknown worker families: ${invalid.join(", ")}`);
  return configured as WorkerFamily[];
}

function concurrency(environment: NodeJS.ProcessEnv): number {
  const value = Number.parseInt(environment.WORKER_CONCURRENCY ?? "2", 10);
  if (!Number.isSafeInteger(value) || value < 1 || value > WORKER_FAMILIES.length) {
    throw new Error(`WORKER_CONCURRENCY must be between 1 and ${WORKER_FAMILIES.length}.`);
  }
  return value;
}

export function createWorkerPoll(environment: NodeJS.ProcessEnv = process.env) {
  const families = enabledFamilies(environment);
  const parallelism = concurrency(environment);
  const handlers: Record<WorkerFamily, () => Promise<number>> = {
    "storage-deletion": async () =>
      (await processStorageDeletionBatch(createAdminClient(), 20)).claimed,
    import: processOneImport,
    research: processOneResearch,
    "wardrobe-compilation": processOneCompilation,
    "outfit-preview": processPreviews,
    "outfit-visualization": processVisualizations,
  };

  return async function poll(): Promise<number> {
    let next = 0;
    let handled = 0;
    async function runner() {
      while (next < families.length) {
        const family = families[next++];
        if (!family) return;
        try {
          const count = await handlers[family]();
          handled += count;
          if (count > 0)
            console.info(JSON.stringify({ event: "worker_family_batch", family, count }));
        } catch (error) {
          console.error(
            JSON.stringify({
              event: "worker_family_failed",
              family,
              message: error instanceof Error ? error.message : "Unknown worker error",
            }),
          );
        }
      }
    }
    await Promise.all(Array.from({ length: parallelism }, runner));
    return handled;
  };
}
