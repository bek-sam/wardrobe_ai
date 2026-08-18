import "server-only";

import { headers } from "next/headers";
import type { FrontendConfigDto, FrontendSessionDto, MfaFactorDto } from "@wardrobe/contracts";

export type FrontendConfig = FrontendConfigDto;
export type FrontendSession = FrontendSessionDto;

function backendUrl(path: string) {
  const origin = process.env.BACKEND_URL ?? "http://127.0.0.1:3001";
  return new URL(path, origin).toString();
}

async function requestBackend<T>(path: string): Promise<T> {
  const incoming = await headers();
  const response = await fetch(backendUrl(path), {
    headers: { cookie: incoming.get("cookie") ?? "" },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json().catch(() => null)) as { data?: T } | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(`Backend request failed (${response.status}).`);
  }
  return payload.data as T;
}

const demoConfig: FrontendConfig = {
  databaseConfigured: false,
  publicSignupEnabled: false,
  googleAuthEnabled: false,
  magicLinkEnabled: false,
  captchaEnabled: false,
  turnstileSiteKey: null,
  capabilities: {
    chatAvailable: false,
    outfitGenerationAvailable: false,
    planGenerationAvailable: false,
    visualizationAvailable: false,
  },
};

export async function getFrontendConfig(): Promise<FrontendConfig> {
  try {
    return await requestBackend<FrontendConfig>("/api/v1/frontend-config");
  } catch {
    return demoConfig;
  }
}

export function getFrontendSession(): Promise<FrontendSession> {
  return requestBackend<FrontendSession>("/api/v1/session");
}

export async function getMfaFactors(): Promise<MfaFactorDto[]> {
  const result = await requestBackend<{ factors: MfaFactorDto[] }>("/api/v1/session/mfa");
  return result.factors;
}
