import type { OutfitItemRole } from "@/features/outfits/types";

export type TodayProfile = {
  firstName: string | null;
  displayName: string | null;
  locationName: string | null;
  timezone: string;
  locale: string;
  temperatureUnit: "celsius" | "fahrenheit";
};

export type TodayItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string;
  subcategory: string | null;
  layerRole: OutfitItemRole | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  colorNames: string[];
  availability: string;
  primaryImageUrl: string | null;
  createdAt: string | null;
};

export type WeatherView = {
  provider: string | null;
  date: string | null;
  locationName: string | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  minimumC: number | null;
  maximumC: number | null;
  rainProbability: number | null;
  precipitationMm: number | null;
  snowfallCm: number | null;
  windKph: number | null;
  humidityPercent: number | null;
  temperatureBand: string | null;
  constraints: string[];
};

export type OutfitSelection = { item_id: string; role: OutfitItemRole; sort_order: number };

export type TodayPreviewInfo = {
  candidateId: string;
  status: "none" | "queued" | "generating" | "ready" | "failed";
  styleTags: string[];
};

export type TodayRecommendation = {
  generationId: string | null;
  title: string;
  items: OutfitSelection[];
  itemDetails: Record<string, TodayItem>;
  explanation: string;
  warnings: string[];
  confidence: number;
  missingCategory: string | null;
  followUpQuestion: string | null;
  weather: WeatherView | null;
  excludedItemCount: number;
  savedOutfitId: string | null;
  occasion: string | null;
  preview: TodayPreviewInfo | null;
};

export type NormalizedRecommendation = Omit<TodayRecommendation, "itemDetails" | "occasion">;

export type TodayLookDetailsProps = {
  recommendation: TodayRecommendation;
  recommendationWeather: WeatherView | null;
  previewImageUrl: string | null;
  previewRequestBusy: boolean;
  previewNotice: string | null;
  onRequestPreview: () => void;
  saving: boolean;
  notice: string | null;
  onSave: () => void;
};

export type TodayContextFormProps = {
  occasion: string;
  onOccasion: (value: string) => void;
  generating: "unsaved" | "saved" | null;
  coreLoading: boolean;
  itemCount: number;
  hasItems: boolean;
  aiConfigured: boolean;
  onSubmit: (event: import("react").FormEvent<HTMLFormElement>) => void;
  onBuildAndSave: () => void;
};
