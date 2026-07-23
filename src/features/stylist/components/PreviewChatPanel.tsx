import { PaperPlaneRight, Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/Button";

export function PreviewChatPanel() {
  return (
    <section className="chat-panel" aria-label="Stylist preview">
      <div className="chat-thread">
        <article className="chat-message chat-message--user">
          <p>What should I wear to work tomorrow?</p>
          <time>Sample prompt</time>
        </article>
        <article className="chat-message chat-message--assistant">
          <span className="chat-message__avatar">
            <Sparkle size={17} weight="fill" />
          </span>
          <div>
            <p>A configured stylist would answer here using only authenticated wardrobe IDs.</p>
            <small>Preview response · not account data</small>
          </div>
        </article>
      </div>
      <form className="chat-composer">
        <textarea disabled placeholder="Connect Supabase to ask your stylist…" rows={3} />
        <div>
          <span>Preview mode cannot send messages.</span>
          <Button aria-label="Send disabled in preview" disabled>
            <PaperPlaneRight size={17} weight="fill" />
          </Button>
        </div>
      </form>
    </section>
  );
}
