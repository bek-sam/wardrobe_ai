import OpenAI from "openai";
import { requireEnvironment } from "@/lib/env/server";

let client: OpenAI | undefined;

export function getOpenAIClient(): OpenAI {
  if (client) return client;

  const environment = requireEnvironment("OPENAI_API_KEY");
  client = new OpenAI({
    apiKey: environment.OPENAI_API_KEY,
    baseURL: environment.OPENAI_API_BASE_URL,
    maxRetries: 2,
    timeout: 120_000,
  });
  return client;
}
