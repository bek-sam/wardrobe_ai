import { getOpenAIClient } from "@/lib/ai/client";

import type { ResearchSource } from "./types";

export function collectSources(
  response: Awaited<ReturnType<ReturnType<typeof getOpenAIClient>["responses"]["parse"]>>,
): ResearchSource[] {
  const sources = new Map<string, ResearchSource>();
  for (const item of response.output) {
    if (item.type !== "message") continue;
    for (const content of item.content) {
      if (content.type !== "output_text") continue;
      for (const annotation of content.annotations) {
        if (annotation.type !== "url_citation") continue;
        try {
          const parsed = new URL(annotation.url);
          if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) continue;
          const domain = parsed.hostname.replace(/^www\./, "");
          sources.set(annotation.url, { title: annotation.title, url: annotation.url, domain });
        } catch {
          // Ignore malformed citations instead of persisting an unsafe URL.
        }
      }
    }
  }
  return [...sources.values()];
}
