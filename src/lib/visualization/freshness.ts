import { createHash } from "node:crypto";

import type { VisualizationFreshnessInput } from "./types";

/**
 * Canonical, stable hash over every input that can change the rendered image:
 * ordered roles, exact ordered item IDs, each current cutout's content hash,
 * the identity reference's content hash, the prompt version, the provider
 * capability version, the configured model key, output size/quality, and the
 * QA + localization schema versions.
 *
 * Content hashes, not timestamps: a cutout re-uploaded byte-for-byte
 * identically must not force a second paid generation, and a cutout edited
 * without touching its row's timestamp must.
 */
export function computeVisualizationSourceHash(input: VisualizationFreshnessInput): string {
  const items = [...input.items]
    .sort(
      (first, second) =>
        first.sortOrder - second.sortOrder || first.itemId.localeCompare(second.itemId),
    )
    .map((item) => [item.sortOrder, item.role, item.itemId, item.cutoutSha256].join(":"))
    .join(",");

  const canonical = [
    `items=${items}`,
    `identity=${input.identitySha256}`,
    `prompt=${input.promptVersion}`,
    `capability=${input.capabilityVersion}`,
    `model=${input.modelKey}`,
    `size=${input.outputSize}`,
    `quality=${input.outputQuality}`,
    `qa=${input.qaVersion}`,
    `localization=${input.localizationVersion}`,
  ].join("|");

  return createHash("sha256").update(canonical).digest("hex");
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
