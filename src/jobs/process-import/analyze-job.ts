import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

import { buildAnalysisCandidates } from "./build-analysis-candidates";
import { downloadAndNormalizeOriginal } from "./download-and-normalize-original";
import { markJobAnalyzing } from "./mark-job-analyzing";
import { persistAnalysisResults } from "./persist-analysis-results";
import type { ImportJobRow } from "./types";

export async function analyzeJob(job: ImportJobRow) {
  const admin = createAdminClient();
  const environment = getServerEnvironment();
  const claimed = await markJobAnalyzing(admin, job);
  if (!claimed) return null;

  const normalized = await downloadAndNormalizeOriginal(admin, job);
  const { catalog, candidates } = await buildAnalysisCandidates(
    admin,
    environment,
    job,
    normalized,
  );
  await persistAnalysisResults(admin, environment, job, normalized, catalog, candidates);

  return candidates.length;
}
