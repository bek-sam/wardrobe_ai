import { MARKETPLACE_DOMAINS, RETAILER_DOMAINS } from "./source-domains.data";
import type { ItemClues } from "./types";

export function classifySource(domain: string, clues: ItemClues) {
  const brandToken = clues.brand?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const domainToken = domain.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (brandToken && brandToken.length >= 3 && domainToken.includes(brandToken))
    return "official_brand";
  if (MARKETPLACE_DOMAINS.some((name) => domainToken.includes(name))) return "marketplace";
  if (RETAILER_DOMAINS.some((name) => domainToken.includes(name))) return "retailer";
  return "other";
}
