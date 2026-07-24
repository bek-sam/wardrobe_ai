import type { SupabaseClient } from "@supabase/supabase-js";

import type { researchProduct } from "@/lib/ai/agents/research-agent";

import { classifySource } from "./classify-source";
import type { ItemClues, ResearchRun } from "./types";

export async function upsertResearchSources(
  admin: SupabaseClient,
  run: ResearchRun,
  researched: Awaited<ReturnType<typeof researchProduct>>,
) {
  if (researched.sources.length === 0) return;

  const evidenceByUrl = new Map<string, Set<string>>();
  for (const evidence of researched.result.evidence) {
    const fields = evidenceByUrl.get(evidence.sourceUrl) ?? new Set<string>();
    for (const field of evidence.supportsFields) fields.add(field);
    evidenceByUrl.set(evidence.sourceUrl, fields);
  }

  const { error } = await admin.from("research_sources").upsert(
    researched.sources.map((source) => ({
      user_id: run.user_id,
      research_run_id: run.id,
      title: source.title,
      url: source.url,
      domain: source.domain,
      source_type: classifySource(source.domain, run.input_clues as ItemClues),
      supports_fields: [...(evidenceByUrl.get(source.url) ?? [])],
    })),
    { onConflict: "research_run_id,url" },
  );
  if (error) throw error;
}
