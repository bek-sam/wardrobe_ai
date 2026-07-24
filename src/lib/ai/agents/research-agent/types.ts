export type ProductResearchClues = {
  brand?: string | null;
  productName?: string | null;
  visibleText?: readonly string[];
  modelNumber?: string | null;
  barcode?: string | null;
  category?: string | null;
  colors?: readonly string[];
  description?: string | null;
};

export type ResearchSource = { title: string; url: string; domain: string };
