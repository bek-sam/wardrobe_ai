import { DemoNotice } from "@/components/ui/DemoNotice";

import type { StylistCapabilities } from "../capabilities";

/**
 * Names exactly which routes are unavailable and which still work, so a
 * partially configured deployment does not read as "the stylist is broken".
 */
export function StylistAiDisabledNotice({ capabilities }: { capabilities: StylistCapabilities }) {
  const disabled = [
    capabilities.outfitGenerationAvailable ? null : "outfit requests",
    capabilities.planGenerationAvailable ? null : "planning and packing",
  ].filter((entry): entry is string => entry !== null);
  if (!capabilities.chatAvailable || disabled.length === 0) return null;

  return (
    <DemoNotice>
      This server has no model configured for {disabled.join(" or ")}, so those requests return a
      configuration error rather than a made-up answer. Wardrobe lookups (“do I own a blue blazer?”)
      and insights (“what have I not worn this year?”) are answered from your own items and still
      work normally.
    </DemoNotice>
  );
}
