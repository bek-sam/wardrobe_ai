import { z } from "zod";

import {
  ACTIVITY_LEVELS,
  INDOOR_OUTDOOR_VALUES,
  OCCASION_CATEGORIES,
  TIMES_OF_DAY,
} from "@/lib/recommendation/occasion-context";

export const occasionResolutionSchema = z
  .object({
    category: z.enum(OCCASION_CATEGORIES),
    targetFormality: z.number().int().min(1).max(5),
    indoorOutdoor: z.enum(INDOOR_OUTDOOR_VALUES),
    activityLevel: z.enum(ACTIVITY_LEVELS),
    timeOfDay: z.enum(TIMES_OF_DAY),
    dressCodeConstraints: z.array(z.string().min(1).max(80)).max(5),
    confidence: z.number().min(0).max(1),
    unresolvedQuestions: z.array(z.string().min(1).max(200)).max(3),
  })
  .strict();

export type OccasionResolution = z.infer<typeof occasionResolutionSchema>;
