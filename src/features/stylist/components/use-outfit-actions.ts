import { useConfirmSwap } from "./use-confirm-swap";
import { useOpenSwap } from "./use-open-swap";
import { usePlanOutfit } from "./use-plan-outfit";
import { useSaveOutfit } from "./use-save-outfit";
import { useSendFeedback } from "./use-send-feedback";
import type { useStylingContext } from "./use-styling-context";
import type { useStylistSession } from "./use-stylist-session";

export function useOutfitActions(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
) {
  return {
    saveOutfit: useSaveOutfit(session),
    sendFeedback: useSendFeedback(session),
    planOutfit: usePlanOutfit(session, styling),
    openSwap: useOpenSwap(session),
    confirmSwap: useConfirmSwap(session),
  };
}
