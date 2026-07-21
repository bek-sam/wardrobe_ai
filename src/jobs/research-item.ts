import { researchProduct } from "@/lib/ai/agents/research-agent";
import { getServerEnvironment } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ResearchRun = {
  id: string;
  user_id: string;
  item_id: string;
  status: string;
  input_clues: Record<string, unknown>;
};

type ItemClues = {
  brand?: string | null;
  productName?: string | null;
};

function classifySource(domain: string, clues: ItemClues) {
  const brandToken = clues.brand?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domainToken = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (brandToken && brandToken.length >= 3 && domainToken.includes(brandToken))
    return "official_brand";
  if (
    ["ebay", "poshmark", "depop", "mercari", "etsy", "grailed"].some((name) =>
      domainToken.includes(name),
    )
  ) {
    return "marketplace";
  }
  if (
    [
      "nordstrom",
      "bloomingdales",
      "macys",
      "saksfifthavenue",
      "farfetch",
      "ssense",
      "netaporter",
      "mrporter",
      "asos",
      "zappos",
      "backcountry",
      "rei",
      "endclothing",
      "revolve",
    ].some((name) => domainToken.includes(name))
  ) {
    return "retailer";
  }
  return "other";
}

function proposedChanges(result: Awaited<ReturnType<typeof researchProduct>>["result"]) {
  return {
    brand: result.proposedChanges.brand,
    product_name: result.proposedChanges.productName,
    model_number: result.proposedChanges.modelNumber,
    materials: result.proposedChanges.materials,
    care_instructions: result.proposedChanges.careInstructions,
    purchase_price: result.proposedChanges.typicalPrice,
    currency: result.proposedChanges.currency,
    release_line: result.proposedChanges.releaseLine,
  };
}

export async function processResearchRun(runId: string, expectedUserId?: string) {
  const admin = createAdminClient();
  let query = admin.from("item_research_runs").select("*").eq("id", runId);
  if (expectedUserId) query = query.eq("user_id", expectedUserId);
  const { data, error } = await query.single();
  if (error || !data) throw error ?? new Error("Research run not found.");
  const run = data as ResearchRun;
  if (!["queued", "running", "failed"].includes(run.status)) {
    return { runId, status: run.status };
  }

  await admin
    .from("item_research_runs")
    .update({ status: "running", error_code: null, error_message: null })
    .eq("id", run.id)
    .eq("user_id", run.user_id);

  try {
    const researched = await researchProduct(run.user_id, run.input_clues);
    const evidenceByUrl = new Map<string, Set<string>>();
    for (const evidence of researched.result.evidence) {
      const fields = evidenceByUrl.get(evidence.sourceUrl) ?? new Set<string>();
      for (const field of evidence.supportsFields) fields.add(field);
      evidenceByUrl.set(evidence.sourceUrl, fields);
    }
    if (researched.sources.length > 0) {
      const { error: sourceError } = await admin.from("research_sources").upsert(
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
      if (sourceError) throw sourceError;
    }

    const { error: updateError } = await admin
      .from("item_research_runs")
      .update({
        status: researched.result.status,
        confidence: researched.result.confidence,
        summary: researched.result.summary,
        proposed_changes: proposedChanges(researched.result),
        evidence: researched.result.evidence,
        model: getServerEnvironment().OPENAI_RESEARCH_MODEL,
        locked_at: null,
        locked_until: null,
        next_attempt_at: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("user_id", run.user_id);
    if (updateError) throw updateError;
    await admin.from("agent_runs").insert({
      user_id: run.user_id,
      agent_type: "product_research",
      status: "complete",
      input_summary: { itemId: run.item_id, researchRunId: run.id },
      output_summary: {
        researchStatus: researched.result.status,
        confidence: researched.result.confidence,
        sourceCount: researched.sources.length,
        responseId: researched.responseId,
      },
      model: getServerEnvironment().OPENAI_RESEARCH_MODEL,
      usage: researched.usage ?? {},
    });
    return { runId, status: researched.result.status };
  } catch (error) {
    await admin
      .from("item_research_runs")
      .update({
        status: "failed",
        error_code: "research_failed",
        error_message: "Product research could not be completed.",
        locked_at: null,
        locked_until: null,
        next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("id", run.id)
      .eq("user_id", run.user_id);
    throw error;
  }
}
