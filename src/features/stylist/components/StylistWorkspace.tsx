"use client";

import {
  CalendarBlank,
  Check,
  CloudRain,
  Heart,
  MapPin,
  PaperPlaneRight,
  Shuffle,
  Sparkle,
  SpinnerGap,
  ThumbsDown,
  ThumbsUp,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { Badge, PreviewBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DemoNotice } from "@/components/ui/DemoNotice";
import { PageHeader } from "@/components/ui/PageHeader";
import type { OutfitItemRole } from "@/features/outfits/types";
import {
  GarmentArtwork,
  type GarmentCategory,
} from "@/features/wardrobe/components/GarmentArtwork";
import { resolveWardrobeItemRole } from "@/lib/recommendation/item-role";

import { consumeSse } from "../sse";

type ApiEnvelope<T> = { data: T } | { error: { message?: string } };

type OutfitSelection = {
  item_id: string;
  role: OutfitItemRole;
  sort_order: number;
};

type OwnedItem = {
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

type WeatherView = {
  date: string | null;
  locationName: string | null;
  minimumC: number | null;
  maximumC: number | null;
  feelsLikeC: number | null;
  rainProbability: number | null;
  constraints: string[];
};

type PreviewInfo = {
  candidateId: string;
  status: "none" | "queued" | "generating" | "ready" | "failed";
  styleTags: string[];
};

type Recommendation = {
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

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  note?: string | null;
  time: string;
  structuredResult?: unknown;
};

type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type ConversationTranscript = {
  conversation: ConversationSummary;
  messages: ChatMessage[];
  count: number;
  hasEarlierMessages: boolean;
};

type SwapState = {
  removeItemId: string;
  role: OutfitItemRole;
  candidates: OwnedItem[];
  replacementId: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const roles = new Set<OutfitItemRole>(["top", "bottom", "dress", "layer", "shoes", "accessory"]);

const quickPrompts = [
  "Dress me for work tomorrow",
  "A casual rainy-day look",
  "What goes with my favorite layer?",
  "Plan a dinner outfit",
];

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function errorMessage(payload: unknown, fallback: string) {
  if (isObject(payload) && isObject(payload.error) && typeof payload.error.message === "string") {
    return payload.error.message;
  }
  return fallback;
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !payload || !("data" in payload)) {
    throw new Error(errorMessage(payload, `The request failed (${response.status}).`));
  }
  return payload.data;
}

function currentTime() {
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

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function safeNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function safeNumber(value: unknown, minimum?: number, maximum?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (minimum !== undefined && value < minimum) return null;
  if (maximum !== undefined && value > maximum) return null;
  return value;
}

function safeStrings(value: unknown, maximum = 20) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string").slice(0, maximum)
    : [];
}

function safeColor(value: unknown) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
}

function safeTimestamp(value: unknown) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return value;
}

function normalizeConversation(value: unknown): ConversationSummary | null {
  if (!isObject(value)) return null;
  const id = safeString(value.id);
  const createdAt = safeTimestamp(value.created_at);
  const updatedAt = safeTimestamp(value.updated_at);
  if (!uuidPattern.test(id) || !createdAt || !updatedAt) return null;
  return {
    id,
    title: safeString(value.title, "Conversation").slice(0, 160),
    createdAt,
    updatedAt,
  };
}

function normalizeConversationList(value: unknown) {
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

function normalizeConversationTranscript(
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

function conversationOptionLabel(conversation: ConversationSummary) {
  const date = new Date(conversation.updatedAt);
  const dateLabel = Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date)
    : "Recent";
  return `${conversation.title} · ${dateLabel}`;
}

function normalizeOwnedItem(value: unknown, expectedId?: string): OwnedItem | null {
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

const previewStatuses = new Set(["none", "queued", "generating", "ready", "failed"]);

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

function normalizeRecommendation(value: unknown): Omit<Recommendation, "itemDetails"> | null {
  if (!isObject(value) || !isObject(value.outfit)) return null;
  const conversationId = safeString(value.conversationId);
  if (!uuidPattern.test(conversationId)) return null;
  const rawGenerationId = safeNullableString(value.generationId);
  const generationId =
    rawGenerationId && uuidPattern.test(rawGenerationId) ? rawGenerationId : null;
  const outfit = value.outfit;
  if (!Array.isArray(outfit.items)) return null;
  const items: OutfitSelection[] = [];
  const itemIds = new Set<string>();
  for (const [index, entry] of outfit.items.entries()) {
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
  if (!items.length) return null;
  const confidence = safeNumber(outfit.confidence, 0, 1);
  return {
    conversationId,
    generationId,
    title: safeString(outfit.title, "Wardrobe look"),
    items,
    explanation: safeString(outfit.explanation, "Your recommendation is ready."),
    warnings: safeStrings(outfit.warnings, 10),
    confidence: confidence ?? 0,
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

function recommendationFromStoredMessage(message: ChatMessage, conversationId: string) {
  if (!isObject(message.structuredResult)) return null;
  return normalizeRecommendation({ ...message.structuredResult, conversationId });
}

function artworkCategory(role: OutfitItemRole): GarmentCategory {
  if (role === "bottom") return "bottom";
  if (role === "dress") return "dress";
  if (role === "layer") return "layer";
  if (role === "shoes") return "shoes";
  if (role === "accessory") return "accessory";
  return "top";
}

function PreviewStylist() {
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
      </div>
    </>
  );
}

export function StylistWorkspace({
  supabaseConfigured,
  aiConfigured,
  initialDate,
}: {
  supabaseConfigured: boolean;
  aiConfigured: boolean;
  initialDate: string;
}) {
  const abortRef = useRef<AbortController | null>(null);
  const historyListAbortRef = useRef<AbortController | null>(null);
  const historyTranscriptAbortRef = useRef<AbortController | null>(null);
  const [message, setMessage] = useState("");
  const [date, setDate] = useState(initialDate);
  const [location, setLocation] = useState("");
  const [occasion, setOccasion] = useState("");
  const [targetFormality, setTargetFormality] = useState("");
  const [indoorOutdoor, setIndoorOutdoor] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [streamState, setStreamState] = useState<"idle" | "thinking" | "details">("idle");
  const [error, setError] = useState<string | null>(null);
  const [savedOutfitId, setSavedOutfitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [planned, setPlanned] = useState(false);
  const [swap, setSwap] = useState<SwapState | null>(null);
  const [swapBusy, setSwapBusy] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationCount, setConversationCount] = useState(0);
  const [historyListLoading, setHistoryListLoading] = useState(supabaseConfigured);
  const [historyTranscriptLoading, setHistoryTranscriptLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewRequestBusy, setPreviewRequestBusy] = useState(false);
  // Scoped to the candidateId they were set for, so switching to a different
  // recommendation's preview (a new candidateId) implicitly drops stale
  // notices/overrides without needing an effect to reset them.
  const [previewNoticeState, setPreviewNoticeState] = useState<{
    candidateId: string;
    message: string;
  } | null>(null);
  // Overrides recommendation.preview.status once the user asks for a preview
  // in this session, so the UI reflects queued -> generating -> ready/failed
  // as processOwnedOutfitPreviewJob runs, without waiting on a fresh
  // recommendation from the stylist to pick up the new status.
  const [previewStatusOverride, setPreviewStatusOverride] = useState<{
    candidateId: string;
    status: PreviewInfo["status"];
  } | null>(null);

  const previewCandidateId = recommendation?.preview?.candidateId ?? null;
  const previewLocalStatus =
    previewStatusOverride?.candidateId === previewCandidateId ? previewStatusOverride.status : null;
  const previewStatus = previewLocalStatus ?? recommendation?.preview?.status ?? null;
  const previewNotice =
    previewNoticeState?.candidateId === previewCandidateId ? previewNoticeState.message : null;
  const setPreviewLocalStatus = useCallback(
    (status: PreviewInfo["status"]) => {
      if (previewCandidateId) setPreviewStatusOverride({ candidateId: previewCandidateId, status });
    },
    [previewCandidateId],
  );
  const setPreviewNotice = useCallback(
    (message: string | null) => {
      if (!previewCandidateId) return;
      setPreviewNoticeState(message ? { candidateId: previewCandidateId, message } : null);
    },
    [previewCandidateId],
  );

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setPreviewImageUrl(null);
      if (!previewCandidateId || previewStatus !== "ready") return;
      try {
        const data = await requestJson<{ status: string; previewUrl: string | null }>(
          `/api/outfit-candidates/${previewCandidateId}/preview`,
          { signal: controller.signal },
        );
        setPreviewImageUrl(data.previewUrl);
      } catch {
        // A failed fetch just means no image renders; the rest of the
        // recommendation is unaffected.
      }
    })();
    return () => controller.abort();
  }, [previewCandidateId, previewStatus]);

  const requestPreview = useCallback(async () => {
    if (!previewCandidateId) return;
    setPreviewRequestBusy(true);
    setPreviewNotice(null);
    setPreviewLocalStatus("queued");
    try {
      const enqueued = await requestJson<{ status: string }>(
        `/api/outfit-candidates/${previewCandidateId}/preview`,
        { method: "POST" },
      );
      if (enqueued.status === "already_fresh") {
        setPreviewLocalStatus("ready");
        setPreviewNotice("A preview is already ready.");
        return;
      }
      // Immediately try to claim and render the job we just enqueued, so
      // this completes without waiting on a scheduler to call the
      // secret-gated internal worker route.
      setPreviewLocalStatus("generating");
      const processed = await requestJson<{ status: string }>(
        `/api/outfit-candidates/${previewCandidateId}/preview/process`,
        { method: "POST" },
      );
      const nextStatus = previewStatuses.has(processed.status)
        ? (processed.status as PreviewInfo["status"])
        : "generating";
      setPreviewLocalStatus(nextStatus);
      if (nextStatus === "queued" || nextStatus === "generating") {
        setPreviewNotice("Preview requested — this can take a minute. Check back shortly.");
      }
    } catch (previewError) {
      setPreviewLocalStatus("failed");
      setPreviewNotice(
        previewError instanceof Error
          ? previewError.message
          : "The preview could not be requested.",
      );
    } finally {
      setPreviewRequestBusy(false);
    }
  }, [previewCandidateId, setPreviewLocalStatus, setPreviewNotice]);

  const loadConversationList = useCallback(async () => {
    if (!supabaseConfigured) return;
    historyListAbortRef.current?.abort();
    const controller = new AbortController();
    historyListAbortRef.current = controller;
    setHistoryListLoading(true);
    setHistoryError(null);
    try {
      const raw = await requestJson<unknown>("/api/stylist/conversations?limit=12&offset=0", {
        signal: controller.signal,
      });
      const normalized = normalizeConversationList(raw);
      if (!normalized) throw new Error("Recent conversations returned an invalid response.");
      if (!controller.signal.aborted) {
        setConversations(normalized.conversations);
        setConversationCount(normalized.count);
      }
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
      abortRef.current?.abort();
      historyListAbortRef.current?.abort();
      historyTranscriptAbortRef.current?.abort();
    };
  }, [loadConversationList, supabaseConfigured]);

  const aiAvailable = supabaseConfigured && aiConfigured;

  async function fetchItemDetails(items: OutfitSelection[], signal: AbortSignal) {
    const settled = await Promise.allSettled(
      items.map(async (item) => {
        const raw = await requestJson<unknown>(`/api/items/${encodeURIComponent(item.item_id)}`, {
          signal,
        });
        return normalizeOwnedItem(raw, item.item_id);
      }),
    );
    if (signal.aborted) throw new DOMException("The request was aborted.", "AbortError");
    const details = new Map<string, OwnedItem>();
    settled.forEach((entry, index) => {
      if (entry.status === "fulfilled" && entry.value) {
        details.set(items[index]!.item_id, entry.value);
      }
    });
    return details;
  }

  function resetConversation() {
    historyTranscriptAbortRef.current?.abort();
    setConversationId(null);
    setMessages([]);
    setRecommendation(null);
    setSavedOutfitId(null);
    setFeedback(null);
    setPlanned(false);
    setSwap(null);
    setError(null);
    setHistoryError(null);
    setHistoryNotice(null);
  }

  async function loadConversation(nextConversationId: string) {
    if (!uuidPattern.test(nextConversationId) || streamState !== "idle") return;
    historyTranscriptAbortRef.current?.abort();
    const controller = new AbortController();
    historyTranscriptAbortRef.current = controller;
    setHistoryTranscriptLoading(true);
    setStreamState("details");
    setHistoryError(null);
    setHistoryNotice(null);
    setConversationId(nextConversationId);
    setMessages([]);
    setRecommendation(null);
    setSavedOutfitId(null);
    setFeedback(null);
    setPlanned(false);
    setSwap(null);
    try {
      const raw = await requestJson<unknown>(
        `/api/stylist/conversations/${encodeURIComponent(nextConversationId)}/messages?limit=100&offset=0`,
        { signal: controller.signal },
      );
      const transcript = normalizeConversationTranscript(raw, nextConversationId);
      if (!transcript) throw new Error("The conversation returned an invalid response.");
      const hydratedMessages = transcript.messages.map((entry) => {
        const storedRecommendation = recommendationFromStoredMessage(entry, nextConversationId);
        return storedRecommendation
          ? {
              ...entry,
              note:
                storedRecommendation.warnings[0] ?? storedRecommendation.followUpQuestion ?? null,
            }
          : entry;
      });
      setMessages(hydratedMessages);
      const latestRecommendation = [...hydratedMessages]
        .reverse()
        .map((entry) => recommendationFromStoredMessage(entry, nextConversationId))
        .find((entry) => entry !== null);
      const notices: string[] = [];
      if (transcript.hasEarlierMessages) {
        notices.push(
          `Showing the latest ${transcript.messages.length} of ${transcript.count} messages.`,
        );
      }
      if (latestRecommendation) {
        setStreamState("details");
        const itemDetails = await fetchItemDetails(latestRecommendation.items, controller.signal);
        const everyItemIsCurrentlyEligible = latestRecommendation.items.every((selection) => {
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
        if (
          itemDetails.size === latestRecommendation.items.length &&
          everyItemIsCurrentlyEligible
        ) {
          setRecommendation({ ...latestRecommendation, itemDetails });
          if (!latestRecommendation.generationId) {
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
      if (!controller.signal.aborted) setHistoryNotice(notices.join(" ") || null);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setHistoryError(
        caught instanceof Error ? caught.message : "The conversation could not be loaded.",
      );
    } finally {
      if (historyTranscriptAbortRef.current === controller) {
        historyTranscriptAbortRef.current = null;
        setHistoryTranscriptLoading(false);
        setStreamState("idle");
      }
    }
  }

  async function submit(event?: FormEvent<HTMLFormElement>, prompt?: string) {
    event?.preventDefault();
    const requestMessage = (prompt ?? message).trim();
    if (
      !aiAvailable ||
      !requestMessage ||
      !date ||
      streamState !== "idle" ||
      historyTranscriptLoading
    )
      return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setStreamState("thinking");
    setRecommendation(null);
    setSavedOutfitId(null);
    setFeedback(null);
    setPlanned(false);
    setSwap(null);
    setMessage("");
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: requestMessage,
        time: currentTime(),
      },
    ]);
    let receivedResult = false;
    try {
      const response = await fetch("/api/stylist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          message: requestMessage,
          conversationId,
          date,
          location: location.trim() || null,
          occasion: occasion.trim() || null,
          targetFormality: targetFormality ? Number(targetFormality) : undefined,
          indoorOutdoor: indoorOutdoor || null,
        }),
        signal: controller.signal,
      });
      await consumeSse(response, async (streamEvent) => {
        if (streamEvent.name === "status" && isObject(streamEvent.data)) {
          const nextConversationId = safeString(streamEvent.data.conversationId);
          if (uuidPattern.test(nextConversationId)) setConversationId(nextConversationId);
          setStreamState("thinking");
          return;
        }
        if (streamEvent.name === "error") {
          const streamMessage = isObject(streamEvent.data)
            ? safeString(streamEvent.data.message)
            : "";
          throw new Error(streamMessage || "A wardrobe recommendation could not be completed.");
        }
        if (streamEvent.name !== "result") return;
        const normalized = normalizeRecommendation(streamEvent.data);
        if (!normalized) throw new Error("The stylist returned an invalid recommendation.");
        receivedResult = true;
        setConversationId(normalized.conversationId);
        setStreamState("details");
        const itemDetails = await fetchItemDetails(normalized.items, controller.signal);
        const next = { ...normalized, itemDetails };
        setRecommendation(next);
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: normalized.explanation,
            note: normalized.warnings[0] ?? normalized.followUpQuestion,
            time: currentTime(),
          },
        ]);
      });
      if (!receivedResult)
        throw new Error("The stylist stream ended before a recommendation arrived.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(
        caught instanceof Error ? caught.message : "The stylist request could not be completed.",
      );
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setStreamState("idle");
      if (!controller.signal.aborted) void loadConversationList();
    }
  }

  async function saveOutfit() {
    if (!recommendation || savedOutfitId) return;
    if (!recommendation.generationId) {
      setError(
        "This recommendation is missing its secure generation record. Generate it again before saving.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await requestJson<unknown>("/api/outfits/generated", {
        method: "POST",
        body: JSON.stringify({ generationId: recommendation.generationId }),
      });
      if (!isObject(saved) || typeof saved.id !== "string" || !uuidPattern.test(saved.id)) {
        throw new Error("The saved outfit response was invalid.");
      }
      setSavedOutfitId(saved.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function sendFeedback(kind: "like" | "dislike") {
    if (!savedOutfitId || feedbackBusy) return;
    setFeedbackBusy(true);
    setError(null);
    try {
      await requestJson<unknown>(`/api/outfits/${encodeURIComponent(savedOutfitId)}/feedback`, {
        method: "POST",
        body: JSON.stringify({ feedback_type: kind, comment: null }),
      });
      setFeedback(kind);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Feedback could not be saved.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function planOutfit() {
    if (!savedOutfitId || !recommendation || planned) return;
    setSaving(true);
    setError(null);
    try {
      await requestJson<unknown>("/api/plans", {
        method: "POST",
        body: JSON.stringify({
          outfit_id: savedOutfitId,
          planned_date: date,
          start_time: null,
          occasion: occasion.trim() || null,
          location_name: location.trim() || recommendation.weather?.locationName || null,
          event_title: null,
          weather_snapshot: recommendation.weather
            ? {
                minimumTemperatureC: recommendation.weather.minimumC,
                maximumTemperatureC: recommendation.weather.maximumC,
                precipitationProbability: recommendation.weather.rainProbability,
              }
            : null,
          status: "planned",
        }),
      });
      setPlanned(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit could not be planned.");
    } finally {
      setSaving(false);
    }
  }

  async function openSwap(selection: OutfitSelection) {
    if (!savedOutfitId || !recommendation) return;
    setSwapBusy(true);
    setError(null);
    try {
      const result = await requestJson<unknown>(
        "/api/items?status=active&availability=available&limit=100",
      );
      const rawItems = isObject(result) && Array.isArray(result.items) ? result.items : [];
      const selectedIds = new Set(recommendation.items.map((item) => item.item_id));
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
      setSwap({
        removeItemId: selection.item_id,
        role: selection.role,
        candidates,
        replacementId: candidates[0]?.id ?? "",
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Replacement items could not be loaded.");
    } finally {
      setSwapBusy(false);
    }
  }

  async function confirmSwap() {
    if (!swap || !swap.replacementId || !savedOutfitId || !recommendation) return;
    setSwapBusy(true);
    setError(null);
    try {
      await requestJson<unknown>(`/api/outfits/${encodeURIComponent(savedOutfitId)}/swap`, {
        method: "POST",
        body: JSON.stringify({
          remove_item_id: swap.removeItemId,
          replacement_item_id: swap.replacementId,
        }),
      });
      const replacement = swap.candidates.find((item) => item.id === swap.replacementId);
      const details = new Map(recommendation.itemDetails);
      details.delete(swap.removeItemId);
      if (replacement) details.set(replacement.id, replacement);
      setRecommendation({
        ...recommendation,
        itemDetails: details,
        items: recommendation.items.map((item) =>
          item.item_id === swap.removeItemId ? { ...item, item_id: swap.replacementId } : item,
        ),
      });
      setSwap(null);
      setFeedback(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The outfit item could not be swapped.");
    } finally {
      setSwapBusy(false);
    }
  }

  if (!supabaseConfigured) return <PreviewStylist />;

  const currentConversationIsListed = conversations.some(
    (conversation) => conversation.id === conversationId,
  );

  return (
    <>
      <PageHeader
        eyebrow="Wardrobe orchestrator"
        title="Your stylist"
        description="Ask naturally. Recommendations use only authenticated, available wardrobe items."
        meta={
          <Badge tone={aiAvailable ? "sage" : "outline"}>
            {aiAvailable ? "Owned items only" : "AI disabled"}
          </Badge>
        }
        actions={
          messages.length || conversationId ? (
            <Button
              disabled={
                streamState !== "idle" ||
                historyTranscriptLoading ||
                saving ||
                feedbackBusy ||
                swapBusy
              }
              onClick={resetConversation}
              variant="ghost"
            >
              Start over
            </Button>
          ) : undefined
        }
      />
      {!aiConfigured ? (
        <DemoNotice>
          Your account is connected, but the AI stylist service is not fully configured. The
          composer is disabled and no sample recommendation is shown as live data.
        </DemoNotice>
      ) : null}
      <div className="stylist-history-bar">
        <label>
          <span>Recent chats</span>
          <select
            disabled={
              streamState !== "idle" ||
              historyTranscriptLoading ||
              saving ||
              feedbackBusy ||
              swapBusy
            }
            onChange={(event) => {
              const nextConversationId = event.target.value;
              if (nextConversationId) void loadConversation(nextConversationId);
              else resetConversation();
            }}
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
        <Button
          disabled={historyListLoading || historyTranscriptLoading || streamState !== "idle"}
          onClick={() => void loadConversationList()}
          variant="ghost"
        >
          Refresh
        </Button>
      </div>
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
      <div className="stylist-context-form" aria-label="Styling context">
        <label>
          <span>Date</span>
          <input
            onChange={(event) => setDate(event.target.value)}
            required
            type="date"
            value={date}
          />
        </label>
        <label>
          <span>Location</span>
          <input
            maxLength={160}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Use home location"
            value={location}
          />
        </label>
        <label>
          <span>Occasion</span>
          <input
            maxLength={120}
            onChange={(event) => setOccasion(event.target.value)}
            placeholder="Work, dinner, travel…"
            value={occasion}
          />
        </label>
        <label>
          <span>Setting</span>
          <select onChange={(event) => setIndoorOutdoor(event.target.value)} value={indoorOutdoor}>
            <option value="">Not specified</option>
            <option value="indoor">Mostly indoors</option>
            <option value="outdoor">Mostly outdoors</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>
        <label>
          <span>Formality</span>
          <select
            onChange={(event) => setTargetFormality(event.target.value)}
            value={targetFormality}
          >
            <option value="">Use my preference</option>
            <option value="1">Very casual</option>
            <option value="2">Casual</option>
            <option value="3">Smart casual</option>
            <option value="4">Formal</option>
            <option value="5">Very formal</option>
          </select>
        </label>
      </div>
      <div className="stylist-layout">
        <section className="chat-panel" aria-label="Stylist conversation">
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
          <div className="chat-thread" aria-live="polite">
            {!messages.length && streamState === "idle" && !historyTranscriptLoading ? (
              <div className="chat-empty-state">
                <span>
                  <Sparkle size={22} />
                </span>
                <h2>What does your day require?</h2>
                <p>Include the occasion, comfort needs, dress code, or how you want to feel.</p>
              </div>
            ) : null}
            {messages.map((entry) => (
              <article className={`chat-message chat-message--${entry.role}`} key={entry.id}>
                {entry.role === "assistant" ? (
                  <span className="chat-message__avatar">
                    <Sparkle size={17} weight="fill" />
                  </span>
                ) : null}
                <div>
                  <p>{entry.content}</p>
                  {entry.note ? <small>{entry.note}</small> : null}
                  <time>{entry.time}</time>
                </div>
              </article>
            ))}
            {streamState !== "idle" ? (
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
            ) : null}
          </div>
          <div className="quick-prompts" aria-label="Suggested prompts">
            {quickPrompts.map((prompt) => (
              <button
                disabled={!aiAvailable || streamState !== "idle" || historyTranscriptLoading}
                key={prompt}
                onClick={() => setMessage(prompt)}
                type="button"
              >
                {prompt}
              </button>
            ))}
          </div>
          <form className="chat-composer" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="stylist-message">
              Ask your stylist
            </label>
            <textarea
              disabled={!aiAvailable || streamState !== "idle" || historyTranscriptLoading}
              id="stylist-message"
              maxLength={2000}
              onChange={(event) => setMessage(event.target.value)}
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
              <Button
                aria-label="Send message"
                disabled={
                  !aiAvailable ||
                  streamState !== "idle" ||
                  historyTranscriptLoading ||
                  !message.trim() ||
                  !date
                }
                type="submit"
              >
                {streamState !== "idle" ? (
                  <SpinnerGap className="spin" size={17} />
                ) : (
                  <PaperPlaneRight size={17} weight="fill" />
                )}
              </Button>
            </div>
          </form>
        </section>

        <aside className="recommendation-panel" aria-labelledby="recommendation-title">
          {!recommendation ? (
            <div className="recommendation-empty-state">
              <span>
                <Sparkle size={24} />
              </span>
              <p className="eyebrow">Your next look</p>
              <h2 id="recommendation-title">No recommendation yet</h2>
              <p>
                Ask a question to build a look from your authenticated wardrobe. No sample pieces
                appear in this live panel.
              </p>
            </div>
          ) : (
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
                <div className="recommendation-preview">
                  {recommendation.preview.styleTags.length ? (
                    <div className="recommendation-preview__tags">
                      {recommendation.preview.styleTags.map((tag) => (
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
                      onClick={() => void requestPreview()}
                      type="button"
                    >
                      {previewRequestBusy ? "Requesting…" : "Generate a modeled preview"}
                    </button>
                  )}
                  {previewNotice ? <small>{previewNotice}</small> : null}
                </div>
              ) : null}
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
              <ol className="recommendation-pieces">
                {recommendation.items.map((selection, index) => {
                  const detail = recommendation.itemDetails.get(selection.item_id);
                  return (
                    <li key={selection.item_id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <strong>{detail?.name ?? "Owned item details unavailable"}</strong>
                        <small>
                          {selection.role} · {detail?.brand ?? detail?.category ?? "verified ID"}
                        </small>
                        <code>{selection.item_id}</code>
                      </div>
                      {savedOutfitId ? (
                        <button
                          disabled={swapBusy}
                          onClick={() => void openSwap(selection)}
                          type="button"
                        >
                          Swap
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
              {recommendation.weather ? (
                <div className="recommendation-weather">
                  <CloudRain size={16} />
                  <span>
                    {recommendation.weather.minimumC !== null &&
                    recommendation.weather.maximumC !== null
                      ? `${Math.round(recommendation.weather.minimumC)}–${Math.round(recommendation.weather.maximumC)}°C`
                      : "Weather context available"}
                    {recommendation.weather.rainProbability !== null
                      ? ` · ${Math.round(recommendation.weather.rainProbability)}% rain`
                      : ""}
                  </span>
                </div>
              ) : null}
              {recommendation.warnings.length || recommendation.missingCategory ? (
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
              ) : (
                <div className="recommendation-note">
                  <Check size={16} weight="bold" />
                  <p>
                    <strong>All pieces verified</strong>
                    {recommendation.excludedItemCount} unavailable or unsuitable items were
                    excluded.
                  </p>
                </div>
              )}
              <div className="recommendation-actions">
                <Button
                  disabled={saving || Boolean(savedOutfitId) || !recommendation.generationId}
                  fullWidth
                  onClick={() => void saveOutfit()}
                >
                  {saving ? <SpinnerGap className="spin" size={16} /> : <Heart size={16} />}
                  {savedOutfitId
                    ? "Outfit saved"
                    : recommendation.generationId
                      ? "Save outfit"
                      : "Read-only look"}
                </Button>
                <Button
                  disabled={!savedOutfitId || planned || saving}
                  fullWidth
                  onClick={() => void planOutfit()}
                  variant="secondary"
                >
                  <CalendarBlank size={16} /> {planned ? "Planned" : `Plan for ${date}`}
                </Button>
              </div>
              {savedOutfitId ? (
                <div className="recommendation-feedback" aria-label="Outfit feedback">
                  <span>Was this useful?</span>
                  <button
                    aria-label="Like outfit"
                    aria-pressed={feedback === "like"}
                    className={feedback === "like" ? "is-active" : ""}
                    disabled={feedbackBusy}
                    onClick={() => void sendFeedback("like")}
                    type="button"
                  >
                    <ThumbsUp size={15} />
                  </button>
                  <button
                    aria-label="Dislike outfit"
                    aria-pressed={feedback === "dislike"}
                    className={feedback === "dislike" ? "is-active" : ""}
                    disabled={feedbackBusy}
                    onClick={() => void sendFeedback("dislike")}
                    type="button"
                  >
                    <ThumbsDown size={15} />
                  </button>
                </div>
              ) : (
                <p className="recommendation-save-hint">
                  {recommendation.generationId
                    ? "Save the outfit to enable swaps and feedback."
                    : "Continue this chat to create a new look that can be saved."}
                </p>
              )}
              <Button
                fullWidth
                onClick={() => {
                  setMessage(`Build a different look for ${occasion.trim() || "this occasion"}.`);
                }}
                variant="ghost"
              >
                <Shuffle size={16} /> Ask for a different look
              </Button>
            </>
          )}
        </aside>
      </div>
      {swap ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setSwap(null)}>
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
                onClick={() => setSwap(null)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            {swap.candidates.length ? (
              <>
                <label className="form-field">
                  <span>Available replacement</span>
                  <select
                    className="select-input"
                    onChange={(event) => setSwap({ ...swap, replacementId: event.target.value })}
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
                  <Button onClick={() => setSwap(null)} variant="ghost">
                    Cancel
                  </Button>
                  <Button
                    disabled={swapBusy || !swap.replacementId}
                    onClick={() => void confirmSwap()}
                  >
                    {swapBusy ? <SpinnerGap className="spin" size={15} /> : <Shuffle size={15} />}
                    Confirm swap
                  </Button>
                </div>
              </>
            ) : (
              <div className="empty-state stylist-swap-empty">
                <h2>No available replacement</h2>
                <p>
                  Your wardrobe has no other active, available item with the same resolved role.
                </p>
                <Button onClick={() => setSwap(null)} variant="secondary">
                  Close
                </Button>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
