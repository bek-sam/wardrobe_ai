import { PaperPlaneRight, SpinnerGap } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

import type { ChatComposerProps } from "./stylist.types";

export function ChatComposer({
  message,
  onMessage,
  disabled,
  aiAvailable,
  streamState,
  canSubmit,
  onSubmit,
}: ChatComposerProps) {
  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      <label className="sr-only" htmlFor="stylist-message">
        Ask your stylist
      </label>
      <textarea
        disabled={disabled}
        id="stylist-message"
        maxLength={2000}
        onChange={(event) => onMessage(event.target.value)}
        placeholder={
          aiAvailable
            ? "Ask about an outfit, item, occasion, or trip…"
            : "AI stylist is not configured"
        }
        rows={3}
        value={message}
      />
      <div>
        <span>Only owned, active, available item IDs can be returned.</span>
        <Button aria-label="Send message" disabled={!canSubmit} type="submit">
          {streamState !== "idle" ? (
            <SpinnerGap className="spin" size={17} />
          ) : (
            <PaperPlaneRight size={17} weight="fill" />
          )}
        </Button>
      </div>
    </form>
  );
}
