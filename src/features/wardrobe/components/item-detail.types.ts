import type { WardrobeItem } from "@/features/wardrobe/types";

export type ItemImage = {
  id: string;
  kind: string;
  signed_url: string;
  is_primary: boolean;
  width: number;
  height: number;
};

export type ItemDetail = WardrobeItem & {
  images: ItemImage[];
  primary_image_url: string | null;
};

export type ResearchSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  source_type: string;
};

export type ResearchRun = {
  id: string;
  status: string;
  summary: string;
  confidence: number | null;
  proposed_changes: Record<string, unknown>;
  evidence: Record<string, unknown>;
  research_sources: ResearchSource[];
};

export type ItemEditValues = { name: string; brand: string; category: string; notes: string };

export type ItemAction = (name: string, operation: () => Promise<void>) => Promise<void>;

export type ResearchCardProps = {
  itemId: string;
  latestResearch: ResearchRun | null;
  researchFields: string[];
  researchClue: string;
  setResearchClue: (value: string) => void;
  busy: string | null;
  action: ItemAction;
  reload: () => Promise<void>;
};
