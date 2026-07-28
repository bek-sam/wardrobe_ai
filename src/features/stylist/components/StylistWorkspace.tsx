"use client";

import type { StylistCapabilities } from "../capabilities";

import { ChatPanel } from "./ChatPanel";
import { PreviewStylist } from "./PreviewStylist";
import { RecommendationPanel } from "./RecommendationPanel";
import { StylistTopSection } from "./StylistTopSection";
import { SwapDialog } from "./SwapDialog";
import { useStylistWorkspaceState } from "./use-stylist-workspace-state";

export function StylistWorkspace({
  supabaseConfigured,
  capabilities,
  initialDate,
}: {
  supabaseConfigured: boolean;
  capabilities: StylistCapabilities;
  initialDate: string;
}) {
  const state = useStylistWorkspaceState(supabaseConfigured, capabilities, initialDate);

  if (!supabaseConfigured) return <PreviewStylist />;

  const { session, styling, loader, chat, busy } = state;

  return (
    <>
      <StylistTopSection busy={busy} state={state} />
      <div className="stylist-layout">
        <ChatPanel
          chatAvailable={state.chatAvailable}
          historyTranscriptLoading={loader.historyTranscriptLoading}
          onSubmit={chat.submit}
          session={session}
          styling={styling}
        />
        <RecommendationPanel state={state} />
      </div>
      {session.swap ? (
        <SwapDialog
          onChangeReplacement={(replacementId) =>
            session.setSwap((current) => (current ? { ...current, replacementId } : current))
          }
          onClose={() => session.setSwap(null)}
          onConfirm={() => void state.actions.confirmSwap()}
          swap={session.swap}
          swapBusy={session.swapBusy}
        />
      ) : null}
    </>
  );
}
