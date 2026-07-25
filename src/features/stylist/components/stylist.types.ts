import type { OutfitItemRole } from "@/features/outfits/types";

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
  aiAvailable: boolean;
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
