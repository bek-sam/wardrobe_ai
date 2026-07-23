import { SpinnerGap } from "@phosphor-icons/react";

export function ChatThinkingIndicator({ streamState }: { streamState: "thinking" | "details" }) {
  return (
    <article className="chat-message chat-message--assistant chat-message--thinking">
      <span className="chat-message__avatar">
        <SpinnerGap className="spin" size={17} />
      </span>
      <div>
        <p>
          {streamState === "thinking"
            ? "Checking your wardrobe, context, and weather…"
            : "Verifying each returned item against your wardrobe…"}
        </p>
      </div>
    </article>
  );
}
