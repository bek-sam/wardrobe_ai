export type ResearchRun = {
  id: string;
  user_id: string;
  item_id: string;
  status: string;
  input_clues: Record<string, unknown>;
};

export type ItemClues = {
  brand?: string | null;
  productName?: string | null;
};
