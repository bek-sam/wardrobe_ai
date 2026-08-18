import type { AiTaskName } from "@wardrobe/contracts";

const DEFAULT_TIMEOUT_MS = 120_000;

type EncodedBuffer = { __buffer: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function encode(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return { __buffer: value.toString("base64") } satisfies EncodedBuffer;
  if (Array.isArray(value)) return value.map(encode);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
}

function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (!isRecord(value)) return value;
  if (Object.keys(value).length === 1 && typeof value.__buffer === "string") {
    return Buffer.from(value.__buffer, "base64");
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

/**
 * The only Backend → AI network adapter. It never accepts a free-form provider
 * request: callers select one allow-listed task implemented by AI Orchestration.
 */
export async function runAiTask<T>(
  task: AiTaskName,
  input: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const baseUrl = process.env.AI_ORCHESTRATION_URL;
  const token = process.env.AI_SERVICE_TOKEN;
  if (!baseUrl || !token || token.length < 32) {
    throw new AiServiceError("AI orchestration is not configured.", 503);
  }
  const deadlineAt = new Date(Date.now() + timeoutMs).toISOString();
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/internal/v1/tasks/${task}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Deadline-At": deadlineAt,
    },
    body: JSON.stringify({ input: encode(input) }),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok || !isRecord(payload) || !("data" in payload)) {
    throw new AiServiceError("AI orchestration could not complete the task.", response.status);
  }
  return decode(payload.data) as T;
}
