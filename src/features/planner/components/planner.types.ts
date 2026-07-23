import type { OutfitItemRole } from "@/features/outfits/types";

export type WeatherView = {
  minimumC: number | null;
  maximumC: number | null;
  rainProbability: number | null;
  snowfallCm: number | null;
  weatherCode: number | null;
};

export type PlanItem = {
  id: string;
  name: string;
  role: OutfitItemRole;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export type PlanView = {
  id: string;
  plannedDate: string;
  startTime: string | null;
  occasion: string | null;
  locationName: string | null;
  eventTitle: string | null;
  status: "planned" | "worn" | "skipped";
  outfitId: string | null;
  outfitName: string | null;
  explanation: string | null;
  weather: WeatherView | null;
  items: PlanItem[];
};

export type OutfitOption = { id: string; name: string };

export type ProfileView = {
  locationName: string | null;
  temperatureUnit: "celsius" | "fahrenheit";
};

export type PlanFormState = {
  plannedDate: string;
  outfitId: string;
  startTime: string;
  occasion: string;
  locationName: string;
  eventTitle: string;
  status: "planned" | "skipped";
};

export type GenerateDay = { date: string; selected: boolean; occasion: string };

export type PlannerToolbarProps = {
  anchor: string;
  today: string;
  dates: string[];
  loading: boolean;
  profile: ProfileView;
  onShift: (days: number) => void;
  onToday: () => void;
};

export type PlanEditorProps = {
  date: string;
  plan: PlanView | null;
  outfits: OutfitOption[];
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
};
