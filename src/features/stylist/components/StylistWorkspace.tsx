"use client";

import { ChatPanel } from "./ChatPanel";
import { PreviewStylist } from "./PreviewStylist";
import { RecommendationPanel } from "./RecommendationPanel";
import { StylistTopSection } from "./StylistTopSection";
import { SwapDialog } from "./SwapDialog";
import { useStylistWorkspaceState } from "./use-stylist-workspace-state";

export function StylistWorkspace({
  supabaseConfigured,
  aiConfigured,
  initialDate,
}: {
  supabaseConfigured: boolean;
  aiConfigured: boolean;
  initialDate: string;
}) {
  const state = useStylistWorkspaceState(supabaseConfigured, aiConfigured, initialDate);

  if (!supabaseConfigured) return <PreviewStylist />;

  const { session, styling, loader, chat, busy } = state;

  return (
    <>
      <StylistTopSection aiConfigured={aiConfigured} busy={busy} state={state} />
      <div className="stylist-layout">
        <ChatPanel
          aiAvailable={state.aiAvailable}
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
