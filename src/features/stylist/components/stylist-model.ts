import type { OutfitItemRole } from "@/features/outfits";
import type { GarmentCategory } from "@/components/garments/GarmentArtwork";
import {
  isObject,
  safeColor,
  safeNullableString,
  safeNumber,
  safeString,
} from "@/lib/api/normalize";
import { resolveWardrobeItemRole } from "@/features/wardrobe";
import { useState } from "react";
import type { MutableRefObject } from "react";
import { requestJson } from "@/lib/api/request";
import { useRef } from "react";
import type { FormEvent } from "react";
import { consumeSse } from "..";
import { useCallback, useEffect } from "react";
import type { StylistCapabilities } from "..";
import { fetchOutfitPreviewUrl } from "@/features/outfits/hooks";
import { requestAndProcessPreview } from "@/features/outfits/hooks";

export type OutfitSelection = { item_id: string; role: OutfitItemRole; sort_order: number };

export type OwnedItem = {
  id: string;
  name: string;
  category: string;
  subcategory: string | null;
  layerRole: OutfitItemRole | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorNames: string[];
  brand: string | null;
  availability: string;
};

export type WeatherView = {
  date: string | null;
  locationName: string | null;
  minimumC: number | null;
  maximumC: number | null;
  feelsLikeC: number | null;
  rainProbability: number | null;
  constraints: string[];
};

export type PreviewInfo = {
  candidateId: string;
  status: "none" | "queued" | "generating" | "ready" | "failed";
  styleTags: string[];
};

export type Recommendation = {
  conversationId: string;
  generationId: string | null;
  title: string;
  items: OutfitSelection[];
  itemDetails: Map<string, OwnedItem>;
  explanation: string;
  warnings: string[];
  confidence: number;
  missingCategory: string | null;
  followUpQuestion: string | null;
  weather: WeatherView | null;
  excludedItemCount: number;
  preview: PreviewInfo | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  note?: string | null;
  /** Summary lines for non-outfit answers (plan days, matches, highlights). */
  details?: string[];
  /** Set only for a saveable planning answer; drives the "Save plan" action. */
  plan?: { generationId: string; saved: boolean } | null;
  time: string;
  structuredResult?: unknown;
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ConversationTranscript = {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  count: number;
  hasEarlierMessages: boolean;
};

export type SwapState = {
  removeItemId: string;
  role: OutfitItemRole;
  candidates: OwnedItem[];
  replacementId: string;
};

export type ChatComposerProps = {
  message: string;
  onMessage: (value: string) => void;
  disabled: boolean;
  chatAvailable: boolean;
  streamState: "idle" | "thinking" | "details";
  canSubmit: boolean;
  onSubmit: (event: import("react").FormEvent<HTMLFormElement>) => void;
};

export type ConversationHistoryBarProps = {
  conversations: ConversationSummary[];
  conversationCount: number;
  conversationId: string | null;
  currentConversationIsListed: boolean;
  disabled: boolean;
  historyListLoading: boolean;
  onSelect: (conversationId: string) => void;
  onRefresh: () => void;
};

export type StylistRecommendationPreviewProps = {
  preview: PreviewInfo;
  previewStatus: string | null;
  previewImageUrl: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
};

export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const roles = new Set<OutfitItemRole>([
  "top",
  "bottom",
  "dress",
  "layer",
  "shoes",
  "accessory",
]);

export const quickPrompts = [
  "Dress me for work tomorrow",
  "A casual rainy-day look",
  "Plan my outfits for next week",
  "Pack me for 3 days in Chicago",
  "What have I not worn this year?",
  "Do I own a blue blazer?",
];

const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);

const MAX_DETAIL_LINES = 10;

export type PlanAnswerAction = { generationId: string; saved: boolean };

export type StylistAnswerMessage = {
  kind: string;
  answer: string;
  details: string[];
  plan: PlanAnswerAction | null;
};

export function safeStrings(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, maximum)
    : [];
}

function safeTimestamp(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

export function currentTime() {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
    new Date(),
  );
}

function historyTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Saved message";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function artworkCategory(role: OutfitItemRole): GarmentCategory {
  if (role === "bottom") return "bottom";
  if (role === "dress") return "dress";
  if (role === "layer") return "layer";
  if (role === "shoes") return "shoes";
  if (role === "accessory") return "accessory";
  return "top";
}

function itemNames(items: unknown) {
  return Array.isArray(items)
    ? items
        .filter(isObject)
        .map((item) => safeString(item.name))
        .filter(Boolean)
        .join(", ")
    : "";
}

function planLines(value: Record<string, unknown>) {
  return Array.isArray(value.days)
    ? value.days
        .filter(isObject)
        .map(
          (day) => `${safeString(day.date)} · ${safeString(day.title)} — ${itemNames(day.items)}`,
        )
    : [];
}

function packingLines(value: Record<string, unknown>) {
  return Array.isArray(value.packingList)
    ? value.packingList.filter(isObject).map((entry) => {
        const days = typeof entry.dayCount === "number" ? entry.dayCount : 1;
        return `${safeString(entry.name)} — ${safeString(entry.role)} · ${days} ${days === 1 ? "day" : "days"}`;
      })
    : [];
}

function highlightLines(value: Record<string, unknown>) {
  return Array.isArray(value.highlights)
    ? value.highlights.filter(isObject).map((entry) => {
        const detail = safeNullableString(entry.detail);
        return detail ? `${safeString(entry.label)} — ${detail}` : safeString(entry.label);
      })
    : [];
}

function matchLines(value: Record<string, unknown>) {
  return Array.isArray(value.matches)
    ? value.matches.filter(isObject).map((match) => {
        const colors = Array.isArray(match.colorNames) ? match.colorNames.join("/") : "";
        const facts = [safeString(match.category), colors, safeString(match.availability)];
        return `${safeString(match.name)} — ${facts.filter(Boolean).join(" · ")}`;
      })
    : [];
}

const detailBuilders: Record<string, (value: Record<string, unknown>) => string[]> = {
  plan: planLines,
  packing: packingLines,
  insight: highlightLines,
  item_question: matchLines,
};

export function buildAnswerDetails(kind: string, value: Record<string, unknown>) {
  const build = detailBuilders[kind];
  return build ? build(value).filter(Boolean).slice(0, MAX_DETAIL_LINES) : [];
}

function planAction(kind: string, value: Record<string, unknown>): PlanAnswerAction | null {
  if (kind !== "plan") return null;
  const generationId = safeString(value.generationId);
  if (!uuidPattern.test(generationId)) return null;
  return { generationId, saved: value.saved === true };
}

export function normalizeStylistAnswer(value: unknown): StylistAnswerMessage | null {
  if (!isObject(value)) return null;
  const kind = safeString(value.kind);
  if (!kind || kind === "outfit") return null;
  const answer = safeString(value.answer).trim();
  if (!answer) return null;
  return {
    kind,
    answer: answer.slice(0, 1_200),
    details: buildAnswerDetails(kind, value),
    plan: planAction(kind, value),
  };
}

export function normalizeOwnedItem(value: unknown, expectedId?: string): OwnedItem | null {
  if (!isObject(value) || typeof value.id !== "string" || !uuidPattern.test(value.id)) return null;
  if (expectedId && value.id !== expectedId) return null;
  if (value.status !== "active" || value.availability_status !== "available") return null;
  const layerRole = roles.has(value.layer_role as OutfitItemRole)
    ? (value.layer_role as OutfitItemRole)
    : null;
  return {
    id: value.id,
    name: safeString(value.name, "Owned item"),
    category: safeString(value.category, "other"),
    subcategory: safeNullableString(value.subcategory),
    layerRole,
    primaryColor: safeColor(value.primary_color_hex),
    secondaryColor: safeColor(value.secondary_color_hex),
    colorNames: safeStrings(value.color_names, 8),
    brand: safeNullableString(value.brand),
    availability: safeString(value.availability_status, "unknown"),
  };
}

function normalizeStylistItems(rawItems: unknown[]): OutfitSelection[] | null {
  const items: OutfitSelection[] = [];
  const itemIds = new Set<string>();
  for (const [index, entry] of rawItems.entries()) {
    if (!isObject(entry)) return null;
    const itemId = safeString(entry.item_id);
    const role = entry.role as OutfitItemRole;
    if (!uuidPattern.test(itemId) || !roles.has(role) || itemIds.has(itemId)) return null;
    itemIds.add(itemId);
    items.push({
      item_id: itemId,
      role,
      sort_order:
        typeof entry.sort_order === "number" && Number.isInteger(entry.sort_order)
          ? entry.sort_order
          : index,
    });
  }
  return items.length ? items : null;
}

function normalizePreview(value: unknown): PreviewInfo | null {
  if (!isObject(value)) return null;
  const candidateId = safeString(value.candidateId);
  if (!uuidPattern.test(candidateId)) return null;
  const status =
    typeof value.status === "string" && previewStatuses.has(value.status)
      ? (value.status as PreviewInfo["status"])
      : "none";
  return { candidateId, status, styleTags: safeStrings(value.styleTags, 5) };
}

function normalizeWeather(value: unknown): WeatherView | null {
  if (!isObject(value)) return null;
  const snapshot = isObject(value.snapshot) ? value.snapshot : {};
  const location = isObject(value.location) ? value.location : {};
  const constraints = isObject(value.constraints) ? value.constraints : {};
  return {
    date: safeNullableString(value.date),
    locationName: safeNullableString(location.name),
    minimumC: safeNumber(snapshot.minimumTemperatureC),
    maximumC: safeNumber(snapshot.maximumTemperatureC),
    feelsLikeC: safeNumber(snapshot.feelsLikeC),
    rainProbability: safeNumber(snapshot.precipitationProbability, 0, 100),
    constraints: safeStrings(constraints.tags, 12),
  };
}

export function normalizeRecommendation(
  value: unknown,
): Omit<Recommendation, "itemDetails"> | null {
  if (!isObject(value) || !isObject(value.outfit)) return null;
  const conversationId = safeString(value.conversationId);
  if (!uuidPattern.test(conversationId)) return null;
  const rawGenerationId = safeNullableString(value.generationId);
  const generationId =
    rawGenerationId && uuidPattern.test(rawGenerationId) ? rawGenerationId : null;
  const outfit = value.outfit;
  if (!Array.isArray(outfit.items)) return null;
  const items = normalizeStylistItems(outfit.items);
  if (!items) return null;
  return {
    conversationId,
    generationId,
    title: safeString(outfit.title, "Wardrobe look"),
    items,
    explanation: safeString(outfit.explanation, "Your recommendation is ready."),
    warnings: safeStrings(outfit.warnings, 10),
    confidence: safeNumber(outfit.confidence, 0, 1) ?? 0,
    missingCategory: safeNullableString(outfit.missing_category),
    followUpQuestion: safeNullableString(outfit.follow_up_question),
    weather: normalizeWeather(value.weather),
    excludedItemCount:
      typeof value.excludedItemCount === "number" && Number.isInteger(value.excludedItemCount)
        ? Math.max(0, value.excludedItemCount)
        : 0,
    preview: normalizePreview(value.preview),
  };
}

export function recommendationFromStoredMessage(message: ChatMessage, conversationId: string) {
  if (!isObject(message.structuredResult)) return null;
  return normalizeRecommendation({ ...message.structuredResult, conversationId });
}

export function isRecommendationStillEligible(
  items: OutfitSelection[],
  itemDetails: Map<string, OwnedItem>,
): boolean {
  if (itemDetails.size !== items.length) return false;
  return items.every((selection) => {
    const item = itemDetails.get(selection.item_id);
    return (
      item &&
      resolveWardrobeItemRole({
        layer_role: item.layerRole,
        category: item.category,
        subcategory: item.subcategory,
      }) === selection.role
    );
  });
}

export function buildEligibleRecommendation(
  normalized: Omit<Recommendation, "itemDetails">,
  itemDetails: Map<string, OwnedItem>,
): Recommendation {
  return { ...normalized, itemDetails };
}

export function normalizeConversation(value: unknown): ConversationSummary | null {
  if (!isObject(value)) return null;
  const id = safeString(value.id);
  const createdAt = safeTimestamp(value.created_at);
  const updatedAt = safeTimestamp(value.updated_at);
  if (!uuidPattern.test(id) || !createdAt || !updatedAt) return null;
  return { id, title: safeString(value.title, "Conversation").slice(0, 160), createdAt, updatedAt };
}

export function normalizeConversationList(value: unknown) {
  if (!isObject(value) || !Array.isArray(value.conversations)) return null;
  const conversations = value.conversations
    .map(normalizeConversation)
    .filter((conversation): conversation is ConversationSummary => Boolean(conversation));
  return {
    conversations,
    count:
      typeof value.count === "number" && Number.isInteger(value.count)
        ? Math.max(0, value.count)
        : conversations.length,
  };
}

export function conversationOptionLabel(conversation: ConversationSummary) {
  const date = new Date(conversation.updatedAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
    : "Recent";
  return `${conversation.title} · ${dateLabel}`;
}

export function normalizeConversationTranscript(
  value: unknown,
  expectedConversationId: string,
): ConversationTranscript | null {
  if (!isObject(value) || !Array.isArray(value.messages)) return null;
  const conversation = normalizeConversation(value.conversation);
  if (!conversation || conversation.id !== expectedConversationId) return null;
  const messages = value.messages.flatMap((entry): ChatMessage[] => {
    if (!isObject(entry)) return [];
    const id = safeString(entry.id);
    const role = entry.role;
    const content = safeString(entry.content);
    const createdAt = safeTimestamp(entry.created_at);
    if (!uuidPattern.test(id) || (role !== "user" && role !== "assistant") || !createdAt) return [];
    return [
      {
        id,
        role,
        content,
        time: historyTime(createdAt),
        structuredResult: role === "assistant" ? entry.structured_result : null,
      },
    ];
  });
  return {
    conversation,
    messages,
    count:
      typeof value.count === "number" && Number.isInteger(value.count)
        ? Math.max(0, value.count)
        : messages.length,
    hasEarlierMessages: value.hasEarlierMessages === true,
  };
}

export function hydrateTranscriptMessages(
  messages: ChatMessage[],
  conversationId: string,
): ChatMessage[] {
  return messages.map((entry) => {
    const storedRecommendation = recommendationFromStoredMessage(entry, conversationId);
    if (storedRecommendation) {
      return {
        ...entry,
        note: storedRecommendation.warnings[0] ?? storedRecommendation.followUpQuestion ?? null,
      };
    }
    const storedAnswer = normalizeStylistAnswer(entry.structuredResult);
    return storedAnswer
      ? { ...entry, details: storedAnswer.details, plan: storedAnswer.plan }
      : entry;
  });
}

export function findLatestRecommendation(messages: ChatMessage[], conversationId: string) {
  return (
    [...messages]
      .reverse()
      .map((entry) => recommendationFromStoredMessage(entry, conversationId))
      .find((entry) => entry !== null) ?? null
  );
}

function useOutfitFeedbackState() {
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [planned, setPlanned] = useState(false);
  return {
    savedOutfitId,
    setSavedOutfitId,
    saving,
    setSaving,
    feedback,
    setFeedback,
    feedbackBusy,
    setFeedbackBusy,
    planned,
    setPlanned,
  };
}

function useSwapState() {
  const [swap, setSwap] = useState<SwapState | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  return { swap, setSwap, swapBusy, setSwapBusy };
}

export function useStylistSession(
  historyTranscriptAbortRef: MutableRefObject<AbortController | null>,
) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "thinking" | "details">("idle");
  const [error, setError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const outfitState = useOutfitFeedbackState();
  const swapState = useSwapState();

  function resetConversation() {
    historyTranscriptAbortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setRecommendation(null);
    outfitState.setSavedOutfitId(null);
    outfitState.setFeedback(null);
    outfitState.setPlanned(false);
    swapState.setSwap(null);
    setError(null);
    setHistoryNotice(null);
  }

  return {
    historyTranscriptAbortRef,
    conversationId,
    setConversationId,
    messages,
    setMessages,
    recommendation,
    setRecommendation,
    streamState,
    setStreamState,
    error,
    setError,
    historyNotice,
    setHistoryNotice,
    resetConversation,
    ...outfitState,
    ...swapState,
  };
}

/**
 * Appends a non-outfit answer to the transcript. Returns false when the
 * payload is an outfit result, leaving it to the recommendation path.
 */
export function applyAnswerResult(
  data: unknown,
  session: ReturnType<typeof useStylistSession>,
): boolean {
  const answer = normalizeStylistAnswer(data);
  if (!answer) return false;

  const conversationId = isObject(data) ? safeString(data.conversationId) : "";
  if (uuidPattern.test(conversationId)) session.setConversationId(conversationId);
  session.setMessages((current) => [
    ...current,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: answer.answer,
      details: answer.details,
      // Live SSE keeps the same structured metadata a reloaded transcript
      // would, so the save action works without refreshing the page.
      plan: answer.plan,
      time: currentTime(),
    },
  ]);
  return true;
}

export async function fetchConversationList(signal: AbortSignal) {
  const raw = await requestJson<unknown>("/api/stylist/conversations?limit=12&offset=0", {
    signal,
  });
  const normalized = normalizeConversationList(raw);
  if (!normalized) throw new Error("Recent conversations returned an invalid response.");
  return normalized;
}

export async function fetchAndSetConversations(
  controller: AbortController,
  setConversations: (value: ConversationSummary[]) => void,
  setConversationCount: (value: number) => void,
) {
  const normalized = await fetchConversationList(controller.signal);
  if (!controller.signal.aborted) {
    setConversations(normalized.conversations);
    setConversationCount(normalized.count);
  }
}

export async function fetchItemDetails(
  items: OutfitSelection[],
  signal: AbortSignal,
): Promise<Map<string, OwnedItem>> {
  const settled = await Promise.allSettled(
    items.map((item) =>
      requestJson<unknown>(`/api/items/${encodeURIComponent(item.item_id)}`, { signal }),
    ),
  );
  if (signal.aborted) throw new DOMException("The request was aborted.", "AbortError");
  const details = new Map<string, OwnedItem>();
  settled.forEach((entry, index) => {
    if (entry.status === "fulfilled") {
      const normalized = normalizeOwnedItem(entry.value, items[index]!.item_id);
      if (normalized) details.set(items[index]!.item_id, normalized);
    }
  });
  return details;
}

export async function loadConversationTranscript(conversationId: string, signal: AbortSignal) {
  const raw = await requestJson<unknown>(
    `/api/stylist/conversations/${encodeURIComponent(conversationId)}/messages?limit=100&offset=0`,
    { signal },
  );
  const transcript = normalizeConversationTranscript(raw, conversationId);
  if (!transcript) throw new Error("The conversation returned an invalid response.");

  const messages: ChatMessage[] = hydrateTranscriptMessages(transcript.messages, conversationId);
  const latest = findLatestRecommendation(messages, conversationId);
  const notices: string[] = [];
  if (transcript.hasEarlierMessages) {
    notices.push(
      `Showing the latest ${transcript.messages.length} of ${transcript.count} messages.`,
    );
  }

  let recommendation: Recommendation | null = null;
  if (latest) {
    const itemDetails = await fetchItemDetails(latest.items, signal);
    if (isRecommendationStillEligible(latest.items, itemDetails)) {
      recommendation = buildEligibleRecommendation(latest, itemDetails);
      if (!latest.generationId) {
        notices.push(
          "This older recommendation is read-only. Continue the chat to create a securely saveable look.",
        );
      }
    } else {
      notices.push(
        "The saved recommendation is read-only because one or more pieces are no longer active and available.",
      );
    }
  }

  return { messages, recommendation, notice: notices.join(" ") || null };
}

async function applyOutfitResult(
  data: unknown,
  session: ReturnType<typeof useStylistSession>,
  signal: AbortSignal,
) {
  const normalized = normalizeRecommendation(data);
  if (!normalized) throw new Error("The stylist returned an invalid recommendation.");
  session.setConversationId(normalized.conversationId);
  session.setStreamState("details");
  const itemDetails = await fetchItemDetails(normalized.items, signal);
  session.setRecommendation({ ...normalized, itemDetails });
  session.setMessages((current) => [
    ...current,
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: normalized.explanation,
      note: normalized.warnings[0] ?? normalized.followUpQuestion,
      time: currentTime(),
    },
  ]);
  return true;
}

type StreamEvent = { name: string; data: unknown };

export async function handleStreamEvent(
  streamEvent: StreamEvent,
  session: ReturnType<typeof useStylistSession>,
  signal: AbortSignal,
): Promise<boolean> {
  if (streamEvent.name === "status" && isObject(streamEvent.data)) {
    const nextConversationId = safeString(streamEvent.data.conversationId);
    if (uuidPattern.test(nextConversationId)) session.setConversationId(nextConversationId);
    session.setStreamState("thinking");
    return false;
  }
  if (streamEvent.name === "error") {
    const streamMessage = isObject(streamEvent.data) ? safeString(streamEvent.data.message) : "";
    throw new Error(streamMessage || "A wardrobe recommendation could not be completed.");
  }
  if (streamEvent.name !== "result") return false;

  // Plans, packing lists, insights, and item lookups are transcript answers;
  // only an outfit result drives the recommendation panel.
  if (applyAnswerResult(streamEvent.data, session)) return true;
  return applyOutfitResult(streamEvent.data, session, signal);
}

export function useStylingContext(initialDate: string) {
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState("");
  const [occasion, setOccasion] = useState("");
  const [targetFormality, setTargetFormality] = useState("");
  const [indoorOutdoor, setIndoorOutdoor] = useState("");

  return {
    message,
    setMessage,
    date,
    setDate,
    location,
    setLocation,
    occasion,
    setOccasion,
    targetFormality,
    setTargetFormality,
    indoorOutdoor,
    setIndoorOutdoor,
  };
}

async function runChatStream(
  requestMessage: string,
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
  signal: AbortSignal,
) {
  const response = await fetch("/api/stylist/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({
      message: requestMessage,
      conversationId: session.conversationId,
      date: styling.date,
      location: styling.location.trim() || null,
      occasion: styling.occasion.trim() || null,
      targetFormality: styling.targetFormality ? Number(styling.targetFormality) : undefined,
      indoorOutdoor: styling.indoorOutdoor || null,
    }),
    signal,
  });
  let receivedResult = false;
  await consumeSse(response, async (streamEvent) => {
    if (await handleStreamEvent(streamEvent, session, signal)) receivedResult = true;
  });
  if (!receivedResult) {
    throw new Error("The stylist stream ended before a recommendation arrived.");
  }
}

function resetForSubmit(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
  requestMessage: string,
) {
  session.setError(null);
  session.setStreamState("thinking");
  session.setRecommendation(null);
  session.setSavedOutfitId(null);
  session.setFeedback(null);
  session.setPlanned(false);
  session.setSwap(null);
  styling.setMessage("");
  session.setMessages((current) => [
    ...current,
    { id: crypto.randomUUID(), role: "user", content: requestMessage, time: currentTime() },
  ]);
}

export function useChatSubmit(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
  chatAvailable: boolean,
  historyTranscriptLoading: boolean,
  onDone: () => void,
) {
  const abortRef = useRef<AbortController | null>(null);

  async function submit(event?: FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const requestMessage = (prompt ?? styling.message).trim();
    if (
      !chatAvailable ||
      !requestMessage ||
      !styling.date ||
      session.streamState !== "idle" ||
      historyTranscriptLoading
    )
      return;
    const controller = new AbortController();
    abortRef.current = controller;
    resetForSubmit(session, styling, requestMessage);
    try {
      await runChatStream(requestMessage, session, styling, controller.signal);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      session.setError(
        caught instanceof Error ? caught.message : "The stylist request could not be completed.",
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      session.setStreamState("idle");
      if (!controller.signal.aborted) onDone();
    }
  }

  return { submit, abortRef };
}

export function useConversationList(supabaseConfigured: boolean) {
  const historyListAbortRef = useRef<AbortController | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [historyListLoading, setHistoryListLoading] = useState(supabaseConfigured);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const loadConversationList = useCallback(async () => {
    if (!supabaseConfigured) return;
    historyListAbortRef.current?.abort();
    const controller = new AbortController();
    historyListAbortRef.current = controller;
    setHistoryListLoading(true);
    setHistoryError(null);
    try {
      await fetchAndSetConversations(controller, setConversations, setConversationCount);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setHistoryError(
        caught instanceof Error ? caught.message : "Recent conversations could not be loaded.",
      );
    } finally {
      if (historyListAbortRef.current === controller) {
        historyListAbortRef.current = null;
        setHistoryListLoading(false);
      }
    }
  }, [supabaseConfigured]);

  useEffect(() => {
    const timeout = supabaseConfigured
      ? window.setTimeout(() => void loadConversationList(), 0)
      : undefined;
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      historyListAbortRef.current?.abort();
    };
  }, [loadConversationList, supabaseConfigured]);

  return {
    conversations,
    conversationCount,
    historyListLoading,
    historyError,
    setHistoryError,
    loadConversationList,
    historyListAbortRef,
  };
}

export function useLoadConversation(
  session: ReturnType<typeof useStylistSession>,
  abortRef: MutableRefObject<AbortController | null>,
) {
  const [historyTranscriptLoading, setHistoryTranscriptLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  async function loadConversation(nextConversationId: string) {
    if (!uuidPattern.test(nextConversationId) || session.streamState !== "idle") return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setHistoryTranscriptLoading(true);
    session.setStreamState("details");
    setHistoryError(null);
    session.setHistoryNotice(null);
    session.setConversationId(nextConversationId);
    session.setMessages([]);
    session.setRecommendation(null);
    session.setSavedOutfitId(null);
    session.setFeedback(null);
    session.setPlanned(false);
    session.setSwap(null);
    try {
      const result = await loadConversationTranscript(nextConversationId, controller.signal);
      session.setMessages(result.messages);
      if (result.recommendation) session.setRecommendation(result.recommendation);
      if (!controller.signal.aborted) session.setHistoryNotice(result.notice);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setHistoryError(
        caught instanceof Error ? caught.message : "The conversation could not be loaded.",
      );
    } finally {
      // Always cleared, even when this load was superseded: nothing else owns
      // this flag, and `busy` in ChatPanel includes it — leaving it set locks
      // the composer for the rest of the page's life. The stream state is the
      // opposite case: whoever took over owns it now, and forcing it to "idle"
      // here would re-enable the composer in the middle of their request.
      setHistoryTranscriptLoading(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
        session.setStreamState("idle");
      }
    }
  }

  return { historyTranscriptLoading, historyError, setHistoryError, loadConversation };
}

// Scoped to the candidateId they were set for, so switching to a different
// recommendation's preview (a new candidateId) implicitly drops stale
// notices/overrides without needing an effect to reset them.
export function usePreviewOverrides(candidateId: string | null) {
  const [statusOverride, setStatusOverride] = useState<{
    candidateId: string;
    status: PreviewInfo["status"];
  } | null>(null);
  const [noticeState, setNoticeState] = useState<{ candidateId: string; message: string } | null>(
    null,
  );

  const localStatus = statusOverride?.candidateId === candidateId ? statusOverride.status : null;
  const notice = noticeState?.candidateId === candidateId ? noticeState.message : null;

  const setLocalStatus = useCallback(
    (status: PreviewInfo["status"]) => {
      if (candidateId) setStatusOverride({ candidateId, status });
    },
    [candidateId],
  );
  const setNotice = useCallback(
    (message: string | null) => {
      if (candidateId) setNoticeState(message ? { candidateId, message } : null);
    },
    [candidateId],
  );

  return { localStatus, notice, setLocalStatus, setNotice };
}

function useOpenSwap(session: ReturnType<typeof useStylistSession>) {
  return async function openSwap(selection: OutfitSelection) {
    if (!session.savedOutfitId || !session.recommendation) return;
    session.setSwapBusy(true);
    session.setError(null);
    try {
      const result = await requestJson<unknown>(
        "/api/items?status=active&availability=available&limit=100",
      );
      const rawItems = isObject(result) && Array.isArray(result.items) ? result.items : [];
      const selectedIds = new Set(session.recommendation.items.map((item) => item.item_id));
      const candidates = rawItems
        .map((item) => normalizeOwnedItem(item))
        .filter((item): item is OwnedItem => Boolean(item))
        .filter((item) => {
          if (selectedIds.has(item.id)) return false;
          const role = resolveWardrobeItemRole({
            layer_role: item.layerRole,
            category: item.category,
            subcategory: item.subcategory,
          });
          return role === selection.role;
        });
      session.setSwap({
        removeItemId: selection.item_id,
        role: selection.role,
        candidates,
        replacementId: candidates[0]?.id ?? "",
      });
    } catch (caught) {
      session.setError(
        caught instanceof Error ? caught.message : "Replacement items could not be loaded.",
      );
    } finally {
      session.setSwapBusy(false);
    }
  };
}

function usePlanOutfit(
  session: ReturnType<typeof useStylistSession>,
  styling: ReturnType<typeof useStylingContext>,
) {
  return async function planOutfit() {
    if (!session.savedOutfitId || !session.recommendation || session.planned) return;
    session.setSaving(true);
    session.setError(null);
    try {
      const weather = session.recommendation.weather;
      await requestJson<unknown>("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          outfit_id: session.savedOutfitId,
          planned_date: styling.date,
          start_time: null,
          occasion: styling.occasion.trim() || null,
          location_name: styling.location.trim() || weather?.locationName || null,
          event_title: null,
          weather_snapshot: weather
            ? {
                minimumTemperatureC: weather.minimumC,
                maximumTemperatureC: weather.maximumC,
                precipitationProbability: weather.rainProbability,
              }
            : null,
          status: "planned",
        }),
      });
      session.setPlanned(true);
    } catch (caught) {
      session.setError(
        caught instanceof Error ? caught.message : "The outfit could not be planned.",
      );
    } finally {
      session.setSaving(false);
    }
  };
}

function useConfirmSwap(session: ReturnType<typeof useStylistSession>) {
  return async function confirmSwap() {
    const swap = session.swap;
    if (!swap || !swap.replacementId || !session.savedOutfitId || !session.recommendation) return;
    session.setSwapBusy(true);
    session.setError(null);
    try {
      await requestJson<unknown>(`/api/outfits/${encodeURIComponent(session.savedOutfitId)}/swap`, {
        method: "POST",
        body: JSON.stringify({
          remove_item_id: swap.removeItemId,
          replacement_item_id: swap.replacementId,
        }),
      });
      const replacement = swap.candidates.find((item) => item.id === swap.replacementId);
      const details = new Map(session.recommendation.itemDetails);
      details.delete(swap.removeItemId);
      if (replacement) details.set(replacement.id, replacement);
      session.setRecommendation({
        ...session.recommendation,
        itemDetails: details,
        items: session.recommendation.items.map((item) =>
          item.item_id === swap.removeItemId ? { ...item, item_id: swap.replacementId } : item,
        ),
      });
      session.setSwap(null);
      session.setFeedback(null);
    } catch (caught) {
      session.setError(
        caught instanceof Error ? caught.message : "The outfit item could not be swapped.",
      );
    } finally {
      session.setSwapBusy(false);
    }
  };
}

function useSaveOutfit(session: ReturnType<typeof useStylistSession>) {
  return async function saveOutfit() {
    if (!session.recommendation || session.savedOutfitId) return;
    if (!session.recommendation.generationId) {
      session.setError(
        "This recommendation is missing its secure generation record. Generate it again before saving.",
      );
      return;
    }
    session.setSaving(true);
    session.setError(null);
    try {
      const saved = await requestJson<unknown>("/api/outfits/generated", {
        method: "POST",
        body: JSON.stringify({ generationId: session.recommendation.generationId }),
      });
      if (!isObject(saved) || typeof saved.id !== "string" || !uuidPattern.test(saved.id)) {
        throw new Error("The saved outfit response was invalid.");
      }
      session.setSavedOutfitId(saved.id);
    } catch (caught) {
      session.setError(caught instanceof Error ? caught.message : "The outfit could not be saved.");
    } finally {
      session.setSaving(false);
    }
  };
}

function useRequestPreview(
  candidateId: string | null,
  overrides: ReturnType<typeof usePreviewOverrides>,
  setBusy: (value: boolean) => void,
) {
  return async function requestPreview() {
    if (!candidateId) return;
    setBusy(true);
    overrides.setNotice(null);
    overrides.setLocalStatus("queued");
    try {
      const result = await requestAndProcessPreview(candidateId);
      overrides.setLocalStatus(result.status);
      overrides.setNotice(result.notice);
    } catch (previewError) {
      overrides.setLocalStatus("failed");
      overrides.setNotice(
        previewError instanceof Error
          ? previewError.message
          : "The preview could not be requested.",
      );
    } finally {
      setBusy(false);
    }
  };
}

function useSendFeedback(session: ReturnType<typeof useStylistSession>) {
  return async function sendFeedback(kind: "like" | "dislike") {
    if (!session.savedOutfitId || session.feedbackBusy) return;
    session.setFeedbackBusy(true);
    session.setError(null);
    try {
      await requestJson<unknown>(
        `/api/outfits/${encodeURIComponent(session.savedOutfitId)}/feedback`,
        { method: "POST", body: JSON.stringify({ feedback_type: kind, comment: null }) },
      );
      session.setFeedback(kind);
    } catch (caught) {
      session.setError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      session.setFeedbackBusy(false);
    }
  };
}

function useOutfitActions(
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

function useStylistPreview(recommendation: Recommendation | null) {
  const candidateId = recommendation?.preview?.candidateId ?? null;
  const overrides = usePreviewOverrides(candidateId);
  const status = overrides.localStatus ?? recommendation?.preview?.status ?? null;
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  const requestPreview = useRequestPreview(candidateId, overrides, setPreviewRequestBusy);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPreviewImageUrl(null);
      if (!candidateId || status !== "ready") return;
      try {
        setPreviewImageUrl(await fetchOutfitPreviewUrl(candidateId, controller.signal));
      } catch {
        // A failed fetch just means no image renders; the rest of the recommendation is unaffected.
      }
    })();
    return () => controller.abort();
  }, [candidateId, status]);

  return {
    previewStatus: status,
    previewImageUrl,
    previewRequestBusy,
    previewNotice: overrides.notice,
    requestPreview,
  };
}

export function useStylistWorkspaceState(
  supabaseConfigured: boolean,
  capabilities: StylistCapabilities,
  initialDate: string,
) {
  const historyTranscriptAbortRef = useRef<AbortController | null>(null);
  const session = useStylistSession(historyTranscriptAbortRef);
  const styling = useStylingContext(initialDate);
  const list = useConversationList(supabaseConfigured);
  const loader = useLoadConversation(session, historyTranscriptAbortRef);
  // Chat is enabled by the account, not by a model: the wardrobe-lookup and
  // insight routes never call OpenAI, so disabling the composer when only the
  // generation models are missing would remove features that still work.
  const chatAvailable = supabaseConfigured && capabilities.chatAvailable;
  const chat = useChatSubmit(
    session,
    styling,
    chatAvailable,
    loader.historyTranscriptLoading,
    () => void list.loadConversationList(),
  );
  const preview = useStylistPreview(session.recommendation);
  const actions = useOutfitActions(session, styling);
  const busy =
    session.streamState !== "idle" ||
    loader.historyTranscriptLoading ||
    session.saving ||
    session.feedbackBusy ||
    session.swapBusy;

  return {
    session,
    styling,
    list,
    loader,
    chat,
    preview,
    actions,
    capabilities,
    chatAvailable,
    busy,
  };
}
