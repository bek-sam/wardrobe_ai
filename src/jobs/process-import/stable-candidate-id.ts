import { createHash } from "node:crypto";

export function stableCandidateId(jobId: string, ordinal: number) {
  const hex = createHash("sha256").update(`${jobId}:${ordinal}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
