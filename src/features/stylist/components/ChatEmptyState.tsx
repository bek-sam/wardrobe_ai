import { Sparkle } from "@phosphor-icons/react";

export function ChatEmptyState() {
  return (
    <div className="chat-empty-state">
      <span>
        <Sparkle size={22} />
      </span>
      <h2>What does your day require?</h2>
      <p>Include the occasion, comfort needs, dress code, or how you want to feel.</p>
    </div>
  );
}
