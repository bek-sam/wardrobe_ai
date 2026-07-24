import {
  OCCASION_CATEGORIES,
  occasionCategoryProfile,
  occasionCategoryTags,
} from "@/lib/recommendation";

import type { CompilationBucket } from "./types";

// One bucket per normalized occasion category so compiled candidates carry a
// structured, retrieval-filterable occasion signal instead of only raw
// free-text tags. Weather is deliberately excluded here: it changes daily and
// is re-applied as a live filter/adjustment at retrieval time instead of
// being baked in — weather_tags below capture only which conditions a
// candidate's own garments comfortably cover, not "today's" forecast.
export const DEFAULT_COMPILATION_BUCKETS: readonly CompilationBucket[] = OCCASION_CATEGORIES.map(
  (category) => ({
    key: category,
    occasionTags: occasionCategoryTags(category),
    targetFormality: occasionCategoryProfile(category).targetFormality,
  }),
);
