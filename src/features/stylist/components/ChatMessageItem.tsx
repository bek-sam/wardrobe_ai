import { Sparkle } from "@phosphor-icons/react";

import type { ChatMessage } from "./stylist.types";

export function ChatMessageItem({ entry }: { entry: ChatMessage }) {
  return (
    <article className={`chat-message chat-message--${entry.role}`}>
      {entry.role === "assistant" ? (
        <span className="chat-message__avatar">
          <Sparkle size={17} weight="fill" />
        </span>
      ) : null}
      <div>
        <p>{entry.content}</p>
        {entry.details?.length ? (
          <ul className="chat-message__details">
            {entry.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {entry.note ? <small>{entry.note}</small> : null}
        <time>{entry.time}</time>
      </div>
    </article>
  );
}
