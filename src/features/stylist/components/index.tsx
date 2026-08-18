"use client";

import { PreviewBadge } from "@/components/ui";
import { DemoNotice } from "@/components/ui";
import { PageHeader } from "@/components/ui";
import { PaperPlaneRight, Sparkle } from "@phosphor-icons/react";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { Badge } from "@/components/ui";
import { Button } from "@/components/ui";
import { Check, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { requestJson } from "@/lib/api/request";
import type { ChatMessage } from "./stylist-model";
import type { FormEvent } from "react";
import type { useStylingContext } from "./stylist-model";
import type { useStylistSession } from "./stylist-model";
import { CalendarBlank, CloudRain, MapPin } from "@phosphor-icons/react";
import { quickPrompts } from "./stylist-model";
import type { ChatComposerProps } from "./stylist-model";
import { Shuffle } from "@phosphor-icons/react";
import type { Recommendation } from "./stylist-model";
import { ThumbsDown, ThumbsUp } from "@phosphor-icons/react";
import { Heart } from "@phosphor-icons/react";
import type { OutfitSelection, OwnedItem } from "./stylist-model";
import type { StylistRecommendationPreviewProps } from "./stylist-model";
import { artworkCategory } from "./stylist-model";
import { hasGenerationCapability, type StylistCapabilities } from "..";
import { conversationOptionLabel } from "./stylist-model";
import type { ConversationHistoryBarProps } from "./stylist-model";
import { useStylistWorkspaceState } from "./stylist-model";
import { X } from "@phosphor-icons/react";
import type { SwapState } from "./stylist-model";

function PreviewChatPanel() {
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

function PreviewRecommendationPanel() {
  return (
    <aside className="recommendation-panel" aria-labelledby="preview-recommendation-title">
      <div className="recommendation-panel__header">
        <div>
          <p className="eyebrow">Sample recommendation</p>
          <h2 id="preview-recommendation-title">Workday preview</h2>
        </div>
        <Badge tone="outline">Sample</Badge>
      </div>
      <div className="recommendation-panel__canvas">
        <GarmentArtwork category="top" color="#ddd4c2" />
        <GarmentArtwork category="bottom" color="#293647" />
        <GarmentArtwork category="layer" color="#9c7250" />
        <GarmentArtwork category="shoes" color="#292724" />
      </div>
      <p className="recommendation-empty-copy">
        Names, item IDs, saving, swapping, and feedback remain disabled until account data is
        available.
      </p>
    </aside>
  );
}

export function PreviewStylist() {
  return (
    <>
      <PageHeader
        eyebrow="Wardrobe orchestrator"
        title="Your stylist"
        description="Ask naturally. Recommendations use only pieces saved in your wardrobe."
        meta={<PreviewBadge />}
      />
      <DemoNotice>
        This conversation and look are explicitly labeled samples because Supabase is not
        configured. No message is sent and no owned items are inferred.
      </DemoNotice>
      <div className="stylist-layout">
        <PreviewChatPanel />
        <PreviewRecommendationPanel />
      </div>
    </>
  );
}

type SavePlanResponse = { generationId: string; saved: boolean };

/**
 * Owns one plan answer's save state. The request body carries only the
 * generation id -- the plan days themselves are replayed server-side -- and
 * the RPC behind it is idempotent, so a double click cannot save twice.
 */
function useSavePlan(generationId: string, initiallySaved: boolean) {
  const [saved, setSaved] = useState(initiallySaved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saved || saving) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson<SavePlanResponse>("/api/plans/generated", {
        method: "POST",
        body: JSON.stringify({ generationId }),
      });
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return { saved, saving, error, save };
}

/**
 * The explicit save affordance for a chat plan. Kept as its own component so
 * the generic message renderer stays presentational and never owns API or
 * request state.
 */
export function PlanAnswerActions({
  generationId,
  initiallySaved,
}: {
  generationId: string;
  initiallySaved: boolean;
}) {
  const { saved, saving, error, save } = useSavePlan(generationId, initiallySaved);

  if (saved) {
    return (
      <p className="chat-message__action" role="status">
        <Check size={15} /> <span>Plan saved</span>
      </p>
    );
  }

  return (
    <div className="chat-message__action">
      <Button disabled={saving} onClick={() => void save()} variant="ghost">
        {saving ? <SpinnerGap className="spin" size={15} /> : null}
        {saving ? "Saving plan…" : "Save plan"}
      </Button>
      {error ? (
        <span className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={15} /> {error}
        </span>
      ) : null}
    </div>
  );
}

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
        {/* Only a planning answer carries `plan`; packing lists, insights,
            item questions, and outfits never render a save action. */}
        {entry.plan ? (
          <PlanAnswerActions
            generationId={entry.plan.generationId}
            initiallySaved={entry.plan.saved}
          />
        ) : null}
        <time>{entry.time}</time>
      </div>
    </article>
  );
}

function ChatEmptyState() {
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

function ChatThinkingIndicator({ streamState }: { streamState: "thinking" | "details" }) {
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

export function ChatThread({
  messages,
  streamState,
  historyTranscriptLoading,
}: {
  messages: ChatMessage[];
  streamState: "idle" | "thinking" | "details";
  historyTranscriptLoading: boolean;
}) {
  return (
    <div className="chat-thread" aria-live="polite">
      {!messages.length && streamState === "idle" && !historyTranscriptLoading ? (
        <ChatEmptyState />
      ) : null}
      {messages.map((entry) => (
        <ChatMessageItem entry={entry} key={entry.id} />
      ))}
      {streamState !== "idle" ? <ChatThinkingIndicator streamState={streamState} /> : null}
    </div>
  );
}

function ChatComposer({
  message,
  onMessage,
  disabled,
  chatAvailable,
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
          chatAvailable
            ? "Ask about an outfit, item, occasion, or trip…"
            : "Sign in to ask your stylist"
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

function QuickPrompts({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="quick-prompts" aria-label="Suggested prompts">
      {quickPrompts.map((prompt) => (
        <button disabled={disabled} key={prompt} onClick={() => onSelect(prompt)} type="button">
          {prompt}
        </button>
      ))}
    </div>
  );
}

function ChatContextChips({ date, location }: { date: string; location: string }) {
  return (
    <div className="chat-panel__context">
      <span>
        <CalendarBlank size={15} /> {date || "Choose a date"}
      </span>
      <span>
        <MapPin size={15} /> {location.trim() || "Home location"}
      </span>
      <span>
        <CloudRain size={15} /> Forecast checked when available
      </span>
    </div>
  );
}

export function ChatPanel({
  session,
  styling,
  chatAvailable,
  historyTranscriptLoading,
  onSubmit,
}: {
  session: ReturnType<typeof useStylistSession>;
  styling: ReturnType<typeof useStylingContext>;
  chatAvailable: boolean;
  historyTranscriptLoading: boolean;
  onSubmit: (event?: FormEvent<HTMLFormElement>, prompt?: string) => void;
}) {
  const busy = !chatAvailable || session.streamState !== "idle" || historyTranscriptLoading;
  return (
    <section className="chat-panel" aria-label="Stylist conversation">
      <ChatContextChips date={styling.date} location={styling.location} />
      <ChatThread
        historyTranscriptLoading={historyTranscriptLoading}
        messages={session.messages}
        streamState={session.streamState}
      />
      <QuickPrompts disabled={busy} onSelect={(prompt) => onSubmit(undefined, prompt)} />
      <ChatComposer
        chatAvailable={chatAvailable}
        canSubmit={!busy && Boolean(styling.message.trim()) && Boolean(styling.date)}
        disabled={busy}
        message={styling.message}
        onMessage={styling.setMessage}
        onSubmit={(event) => onSubmit(event)}
        streamState={session.streamState}
      />
    </section>
  );
}

function RecommendationActions({
  saving,
  savedOutfitId,
  generationId,
  planned,
  date,
  onSave,
  onPlan,
}: {
  saving: boolean;
  savedOutfitId: string | null;
  generationId: string | null;
  planned: boolean;
  date: string;
  onSave: () => void;
  onPlan: () => void;
}) {
  return (
    <div className="recommendation-actions">
      <Button
        disabled={saving || Boolean(savedOutfitId) || !generationId}
        fullWidth
        onClick={onSave}
      >
        {saving ? <SpinnerGap className="spin" size={16} /> : <Heart size={16} />}
        {savedOutfitId ? "Outfit saved" : generationId ? "Save outfit" : "Read-only look"}
      </Button>
      <Button
        disabled={!savedOutfitId || planned || saving}
        fullWidth
        onClick={onPlan}
        variant="secondary"
      >
        <CalendarBlank size={16} /> {planned ? "Planned" : `Plan for ${date}`}
      </Button>
    </div>
  );
}

function RecommendationFeedback({
  savedOutfitId,
  generationId,
  feedback,
  feedbackBusy,
  onFeedback,
}: {
  savedOutfitId: string | null;
  generationId: string | null;
  feedback: "like" | "dislike" | null;
  feedbackBusy: boolean;
  onFeedback: (kind: "like" | "dislike") => void;
}) {
  if (!savedOutfitId) {
    return (
      <p className="recommendation-save-hint">
        {generationId
          ? "Save the outfit to enable swaps and feedback."
          : "Continue this chat to create a new look that can be saved."}
      </p>
    );
  }
  return (
    <div className="recommendation-feedback" aria-label="Outfit feedback">
      <span>Was this useful?</span>
      <button
        aria-label="Like outfit"
        aria-pressed={feedback === "like"}
        className={feedback === "like" ? "is-active" : ""}
        disabled={feedbackBusy}
        onClick={() => onFeedback("like")}
        type="button"
      >
        <ThumbsUp size={15} />
      </button>
      <button
        aria-label="Dislike outfit"
        aria-pressed={feedback === "dislike"}
        className={feedback === "dislike" ? "is-active" : ""}
        disabled={feedbackBusy}
        onClick={() => onFeedback("dislike")}
        type="button"
      >
        <ThumbsDown size={15} />
      </button>
    </div>
  );
}

function RecommendationWarnings({ recommendation }: { recommendation: Recommendation }) {
  if (recommendation.warnings.length || recommendation.missingCategory) {
    return (
      <div className="recommendation-warnings">
        {recommendation.warnings.map((warning) => (
          <p key={warning}>
            <WarningCircle size={14} /> {warning}
          </p>
        ))}
        {recommendation.missingCategory ? (
          <p>
            <WarningCircle size={14} /> Missing category: {recommendation.missingCategory}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div className="recommendation-note">
      <Check size={16} weight="bold" />
      <p>
        <strong>All pieces verified</strong>
        {recommendation.excludedItemCount} unavailable or unsuitable items were excluded.
      </p>
    </div>
  );
}

function AskDifferentLookButton({
  occasion,
  onSetMessage,
}: {
  occasion: string;
  onSetMessage: (message: string) => void;
}) {
  return (
    <Button
      fullWidth
      onClick={() =>
        onSetMessage(`Build a different look for ${occasion.trim() || "this occasion"}.`)
      }
      variant="ghost"
    >
      <Shuffle size={16} /> Ask for a different look
    </Button>
  );
}

export function RecommendationPanelFooter({
  state,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
}) {
  const { session, styling, actions } = state;
  const recommendation = session.recommendation!;
  return (
    <>
      {recommendation.weather ? (
        <div className="recommendation-weather">
          <CloudRain size={16} />
          <span>
            {recommendation.weather.minimumC !== null && recommendation.weather.maximumC !== null
              ? `${Math.round(recommendation.weather.minimumC)}–${Math.round(recommendation.weather.maximumC)}°C`
              : "Weather context available"}
            {recommendation.weather.rainProbability !== null
              ? ` · ${Math.round(recommendation.weather.rainProbability)}% rain`
              : ""}
          </span>
        </div>
      ) : null}
      <RecommendationWarnings recommendation={recommendation} />
      <RecommendationActions
        date={styling.date}
        generationId={recommendation.generationId}
        onPlan={() => void actions.planOutfit()}
        onSave={() => void actions.saveOutfit()}
        planned={session.planned}
        saving={session.saving}
        savedOutfitId={session.savedOutfitId}
      />
      <RecommendationFeedback
        feedback={session.feedback}
        feedbackBusy={session.feedbackBusy}
        generationId={recommendation.generationId}
        onFeedback={(kind) => void actions.sendFeedback(kind)}
        savedOutfitId={session.savedOutfitId}
      />
      <AskDifferentLookButton occasion={styling.occasion} onSetMessage={styling.setMessage} />
    </>
  );
}

export function RecommendationPieceItem({
  selection,
  index,
  detail,
  swapBusy,
  showSwap,
  onSwap,
}: {
  selection: OutfitSelection;
  index: number;
  detail: OwnedItem | undefined;
  swapBusy: boolean;
  showSwap: boolean;
  onSwap: () => void;
}) {
  return (
    <li>
      <span>{String(index + 1).padStart(2, "0")}</span>
      <div>
        <strong>{detail?.name ?? "Owned item details unavailable"}</strong>
        <small>
          {selection.role} · {detail?.brand ?? detail?.category ?? "verified ID"}
        </small>
        <code>{selection.item_id}</code>
      </div>
      {showSwap ? (
        <button disabled={swapBusy} onClick={onSwap} type="button">
          Swap
        </button>
      ) : null}
    </li>
  );
}

export function RecommendationPiecesList({
  recommendation,
  savedOutfitId,
  swapBusy,
  onSwap,
}: {
  recommendation: Recommendation;
  savedOutfitId: string | null;
  swapBusy: boolean;
  onSwap: (selection: OutfitSelection) => void;
}) {
  return (
    <ol className="recommendation-pieces">
      {recommendation.items.map((selection, index) => (
        <RecommendationPieceItem
          detail={recommendation.itemDetails.get(selection.item_id)}
          index={index}
          key={selection.item_id}
          onSwap={() => onSwap(selection)}
          selection={selection}
          showSwap={Boolean(savedOutfitId)}
          swapBusy={swapBusy}
        />
      ))}
    </ol>
  );
}

export function StylistRecommendationPreview({
  preview,
  previewStatus,
  previewImageUrl,
  previewRequestBusy,
  previewNotice,
  onRequestPreview,
}: StylistRecommendationPreviewProps) {
  return (
    <div className="recommendation-preview">
      {preview.styleTags.length ? (
        <div className="recommendation-preview__tags">
          {preview.styleTags.map((tag) => (
            <Badge key={tag} tone="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
      {previewImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt="Modeled preview of this outfit"
          className="recommendation-preview__image"
          src={previewImageUrl}
        />
      ) : previewStatus === "queued" || previewStatus === "generating" ? (
        <p className="recommendation-preview__status">
          <SpinnerGap className="spin" size={14} /> Modeled preview is generating…
        </p>
      ) : previewStatus === "failed" ? (
        <p className="recommendation-preview__status">
          <WarningCircle size={14} /> The last preview attempt failed.
        </p>
      ) : (
        <button
          className="recommendation-preview__request"
          disabled={previewRequestBusy}
          onClick={onRequestPreview}
          type="button"
        >
          {previewRequestBusy ? "Requesting…" : "Generate a modeled preview"}
        </button>
      )}
      {previewNotice ? <small>{previewNotice}</small> : null}
    </div>
  );
}

function RecommendationCanvas({ recommendation }: { recommendation: Recommendation }) {
  return (
    <div className="recommendation-panel__canvas">
      {recommendation.items.map((selection) => {
        const detail = recommendation.itemDetails.get(selection.item_id);
        return (
          <GarmentArtwork
            category={artworkCategory(selection.role)}
            color={detail?.primaryColor ?? "#9c968b"}
            accent={detail?.secondaryColor ?? undefined}
            key={selection.item_id}
          />
        );
      })}
    </div>
  );
}

export function RecommendationPanelContent({
  state,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
}) {
  const { session, preview, actions } = state;
  const recommendation = session.recommendation!;
  return (
    <>
      <div className="recommendation-panel__header">
        <div>
          <p className="eyebrow">Recommended from your wardrobe</p>
          <h2 id="recommendation-title">{recommendation.title}</h2>
        </div>
        <Badge tone={recommendation.confidence >= 0.75 ? "sage" : "gold"}>
          {Math.round(recommendation.confidence * 100)}% fit
        </Badge>
      </div>
      {recommendation.preview ? (
        <StylistRecommendationPreview
          onRequestPreview={() => void preview.requestPreview()}
          preview={recommendation.preview}
          previewImageUrl={preview.previewImageUrl}
          previewNotice={preview.previewNotice}
          previewRequestBusy={preview.previewRequestBusy}
          previewStatus={preview.previewStatus}
        />
      ) : null}
      <RecommendationCanvas recommendation={recommendation} />
      <RecommendationPiecesList
        onSwap={(selection) => void actions.openSwap(selection)}
        recommendation={recommendation}
        savedOutfitId={session.savedOutfitId}
        swapBusy={session.swapBusy}
      />
      <RecommendationPanelFooter state={state} />
    </>
  );
}

export function StylistHeader({
  capabilities,
  showReset,
  resetDisabled,
  onReset,
}: {
  capabilities: StylistCapabilities;
  showReset: boolean;
  resetDisabled: boolean;
  onReset: () => void;
}) {
  const label = !capabilities.chatAvailable
    ? "Sign in required"
    : hasGenerationCapability(capabilities)
      ? "Owned items only"
      : "Lookups & insights only";
  return (
    <PageHeader
      eyebrow="Wardrobe orchestrator"
      title="Your stylist"
      description="Ask naturally. Recommendations use only authenticated, available wardrobe items."
      meta={<Badge tone={capabilities.chatAvailable ? "sage" : "outline"}>{label}</Badge>}
      actions={
        showReset ? (
          <Button disabled={resetDisabled} onClick={onReset} variant="ghost">
            Start over
          </Button>
        ) : undefined
      }
    />
  );
}

function ConversationHistoryBar({
  conversations,
  conversationCount,
  conversationId,
  currentConversationIsListed,
  disabled,
  historyListLoading,
  onSelect,
  onRefresh,
}: ConversationHistoryBarProps) {
  return (
    <div className="stylist-history-bar">
      <label>
        <span>Recent chats</span>
        <select
          disabled={disabled}
          onChange={(event) => onSelect(event.target.value)}
          value={conversationId ?? ""}
        >
          <option value="">New conversation</option>
          {conversationId && !currentConversationIsListed ? (
            <option value={conversationId}>Current conversation</option>
          ) : null}
          {conversations.map((conversation) => (
            <option key={conversation.id} value={conversation.id}>
              {conversationOptionLabel(conversation)}
            </option>
          ))}
        </select>
      </label>
      <span role="status">
        {historyListLoading
          ? "Loading recent chats…"
          : `${conversations.length} of ${conversationCount} recent chats`}
      </span>
      <Button disabled={disabled} onClick={onRefresh} variant="ghost">
        Refresh
      </Button>
    </div>
  );
}

function StylingContextBasicFields({
  date,
  onDate,
  location,
  onLocation,
  occasion,
  onOccasion,
}: {
  date: string;
  onDate: (value: string) => void;
  location: string;
  onLocation: (value: string) => void;
  occasion: string;
  onOccasion: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span>Date</span>
        <input onChange={(event) => onDate(event.target.value)} required type="date" value={date} />
      </label>
      <label>
        <span>Location</span>
        <input
          maxLength={160}
          onChange={(event) => onLocation(event.target.value)}
          placeholder="Use home location"
          value={location}
        />
      </label>
      <label>
        <span>Occasion</span>
        <input
          maxLength={120}
          onChange={(event) => onOccasion(event.target.value)}
          placeholder="Work, dinner, travel…"
          value={occasion}
        />
      </label>
    </>
  );
}

function StylingContextSelectFields({
  indoorOutdoor,
  onIndoorOutdoor,
  targetFormality,
  onTargetFormality,
}: {
  indoorOutdoor: string;
  onIndoorOutdoor: (value: string) => void;
  targetFormality: string;
  onTargetFormality: (value: string) => void;
}) {
  return (
    <>
      <label>
        <span>Setting</span>
        <select onChange={(event) => onIndoorOutdoor(event.target.value)} value={indoorOutdoor}>
          <option value="">Not specified</option>
          <option value="indoor">Mostly indoors</option>
          <option value="outdoor">Mostly outdoors</option>
          <option value="mixed">Mixed</option>
        </select>
      </label>
      <label>
        <span>Formality</span>
        <select onChange={(event) => onTargetFormality(event.target.value)} value={targetFormality}>
          <option value="">Use my preference</option>
          <option value="1">Very casual</option>
          <option value="2">Casual</option>
          <option value="3">Smart casual</option>
          <option value="4">Formal</option>
          <option value="5">Very formal</option>
        </select>
      </label>
    </>
  );
}

function StylistNotices({
  historyError,
  historyNotice,
  error,
}: {
  historyError: string | null;
  historyNotice: string | null;
  error: string | null;
}) {
  return (
    <>
      {historyError ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{historyError}</span>
        </div>
      ) : null}
      {historyNotice ? (
        <div className="inline-feedback" role="status">
          <Check size={16} /> <span>{historyNotice}</span>
        </div>
      ) : null}
      {error ? (
        <div className="inline-feedback inline-feedback--error" role="alert">
          <WarningCircle size={17} /> <span>{error}</span>
        </div>
      ) : null}
    </>
  );
}

/**
 * Names exactly which routes are unavailable and which still work, so a
 * partially configured deployment does not read as "the stylist is broken".
 */
function StylistAiDisabledNotice({ capabilities }: { capabilities: StylistCapabilities }) {
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

function StylingContextForm({ styling }: { styling: ReturnType<typeof useStylingContext> }) {
  return (
    <div className="stylist-context-form" aria-label="Styling context">
      <StylingContextBasicFields
        date={styling.date}
        location={styling.location}
        occasion={styling.occasion}
        onDate={styling.setDate}
        onLocation={styling.setLocation}
        onOccasion={styling.setOccasion}
      />
      <StylingContextSelectFields
        indoorOutdoor={styling.indoorOutdoor}
        onIndoorOutdoor={styling.setIndoorOutdoor}
        onTargetFormality={styling.setTargetFormality}
        targetFormality={styling.targetFormality}
      />
    </div>
  );
}

export function StylistTopSection({
  state,
  busy,
}: {
  state: ReturnType<typeof useStylistWorkspaceState>;
  busy: boolean;
}) {
  const { session, styling, list, loader } = state;
  const currentConversationIsListed = list.conversations.some(
    (conversation) => conversation.id === session.conversationId,
  );
  return (
    <>
      <StylistHeader
        capabilities={state.capabilities}
        onReset={session.resetConversation}
        resetDisabled={busy}
        showReset={Boolean(session.messages.length || session.conversationId)}
      />
      <StylistAiDisabledNotice capabilities={state.capabilities} />
      <ConversationHistoryBar
        conversationCount={list.conversationCount}
        conversationId={session.conversationId}
        conversations={list.conversations}
        currentConversationIsListed={currentConversationIsListed}
        disabled={busy}
        historyListLoading={list.historyListLoading}
        onRefresh={() => void list.loadConversationList()}
        onSelect={(nextId) =>
          nextId ? void loader.loadConversation(nextId) : session.resetConversation()
        }
      />
      <StylistNotices
        error={session.error}
        historyError={loader.historyError}
        historyNotice={session.historyNotice}
      />
      <StylingContextForm styling={styling} />
    </>
  );
}

function SwapDialogForm({
  swap,
  swapBusy,
  onChangeReplacement,
  onCancel,
  onConfirm,
}: {
  swap: SwapState;
  swapBusy: boolean;
  onChangeReplacement: (replacementId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <label className="form-field">
        <span>Available replacement</span>
        <select
          className="select-input"
          onChange={(event) => onChangeReplacement(event.target.value)}
          value={swap.replacementId}
        >
          {swap.candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.name} · {candidate.id}
            </option>
          ))}
        </select>
      </label>
      <div className="item-form-dialog__actions">
        <Button onClick={onCancel} variant="ghost">
          Cancel
        </Button>
        <Button disabled={swapBusy || !swap.replacementId} onClick={onConfirm}>
          {swapBusy ? <SpinnerGap className="spin" size={15} /> : <Shuffle size={15} />}
          Confirm swap
        </Button>
      </div>
    </>
  );
}

function RecommendationEmptyState() {
  return (
    <div className="recommendation-empty-state">
      <span>
        <Sparkle size={24} />
      </span>
      <p className="eyebrow">Your next look</p>
      <h2 id="recommendation-title">No recommendation yet</h2>
      <p>
        Ask a question to build a look from your authenticated wardrobe. No sample pieces appear in
        this live panel.
      </p>
    </div>
  );
}

function RecommendationPanel({ state }: { state: ReturnType<typeof useStylistWorkspaceState> }) {
  return (
    <aside className="recommendation-panel" aria-labelledby="recommendation-title">
      {!state.session.recommendation ? (
        <RecommendationEmptyState />
      ) : (
        <RecommendationPanelContent state={state} />
      )}
    </aside>
  );
}

function SwapDialog({
  swap,
  swapBusy,
  onClose,
  onChangeReplacement,
  onConfirm,
}: {
  swap: SwapState;
  swapBusy: boolean;
  onClose: () => void;
  onChangeReplacement: (replacementId: string) => void;
  onConfirm: () => void;
}) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="swap-title"
        aria-modal="true"
        className="stylist-swap-dialog"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="item-form-dialog__header">
          <div>
            <p className="eyebrow">Same-role replacement</p>
            <h2 id="swap-title">Swap {swap.role}</h2>
          </div>
          <button
            aria-label="Close swap dialog"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>
        {swap.candidates.length ? (
          <SwapDialogForm
            onCancel={onClose}
            onChangeReplacement={onChangeReplacement}
            onConfirm={onConfirm}
            swap={swap}
            swapBusy={swapBusy}
          />
        ) : (
          <div className="empty-state stylist-swap-empty">
            <h2>No available replacement</h2>
            <p>Your wardrobe has no other active, available item with the same resolved role.</p>
            <Button onClick={onClose} variant="secondary">
              Close
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

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
