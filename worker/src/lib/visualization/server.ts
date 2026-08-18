import { createHash } from "node:crypto";

import type { VisualizationFreshnessInput } from ".";

/**
 * Canonical, stable hash over every input that can change the rendered image:
 * ordered roles and item IDs, content hashes, model configuration, and schema
 * versions. This stays outside the shared visualization module because Node's
 * crypto implementation must never enter the Studio browser bundle.
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
