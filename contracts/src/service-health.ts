export const SERVICE_NAMES = ["backend", "ai-orchestration"] as const;

export type ServiceName = (typeof SERVICE_NAMES)[number];

export interface ServiceHealth {
  service: ServiceName;
  status: "ok";
  version: string;
  startedAt: string;
  checkedAt: string;
}

export const serviceHealthResponseJsonSchema: Record<string, unknown> = {
  $id: "ServiceHealth",
  type: "object",
  additionalProperties: false,
  required: ["service", "status", "version", "startedAt", "checkedAt"],
  properties: {
    service: { type: "string", enum: [...SERVICE_NAMES] },
    status: { type: "string", const: "ok" },
    version: { type: "string", minLength: 1 },
    startedAt: { type: "string", format: "date-time" },
    checkedAt: { type: "string", format: "date-time" },
  },
};

export function parseServiceHealth(value: unknown): ServiceHealth {
  if (!value || typeof value !== "object") throw new Error("Health response must be an object.");

  const candidate = value as Record<string, unknown>;
  if (
    !SERVICE_NAMES.includes(candidate.service as ServiceName) ||
    candidate.status !== "ok" ||
    typeof candidate.version !== "string" ||
    typeof candidate.startedAt !== "string" ||
    typeof candidate.checkedAt !== "string"
  ) {
    throw new Error("Health response does not match the service contract.");
  }

  return candidate as unknown as ServiceHealth;
}
