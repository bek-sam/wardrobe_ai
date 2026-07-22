export { analyzeColorPair, scoreColorHarmony } from "./color-compatibility";
export { filterWardrobeCandidates, getHardFilterReasons } from "./filters";
export { resolveWardrobeItemRole } from "./item-role";
export { analyzeLayering, scoreSilhouetteCompatibility } from "./layering";
export {
  getUnavailableItemIds,
  hasCompleteOutfitStructure,
  isOutfitAvailable,
  outfitCombinationKey,
  outfitFoundationKey,
  selectBalancedOutfitPlans,
} from "./planner";
export {
  ACTIVITY_LEVELS,
  INDOOR_OUTDOOR_VALUES,
  OCCASION_CATEGORIES,
  occasionCategoryProfile,
  occasionCategoryTags,
  resolveOccasionContext,
  TIMES_OF_DAY,
} from "./occasion-context";
export { mapResearchConfidence } from "./research-confidence";
export { rankWardrobeCandidates, scoreWardrobeCandidate } from "./scoring";
export { validateGeneratedOutfit } from "./outfit-validation";
export {
  assertRecommendationWeights,
  createRecommendationWeights,
  DEFAULT_RECOMMENDATION_WEIGHTS,
  weightedRecommendationScore,
} from "./weights";

export type { ColorCompatibility, ColorRelation } from "./color-compatibility";
export type {
  ExcludedWardrobeItem,
  HardFilterContext,
  HardFilterReason,
  HardFilterReasonCode,
  HardFilterResult,
} from "./filters";
export type { LayeringAnalysis } from "./layering";
export type {
  ActivityLevel,
  IndoorOutdoor,
  OccasionCategory,
  OccasionContext,
  TimeOfDay,
} from "./occasion-context";
export type {
  BalancedPlannerOptions,
  BalancedPlannerResult,
  PlannerRejection,
  PlannerRejectionReason,
} from "./planner";
export type {
  ResearchConfidenceInput,
  ResearchConfidenceResult,
  ResearchMatchStatus,
  ResearchSourceType,
} from "./research-confidence";
export type {
  CandidatePreferenceContext,
  CandidateScore,
  CandidateScoringContext,
} from "./scoring";
export type {
  OutfitValidationIssue,
  OutfitValidationIssueCode,
  OutfitValidationOptions,
  OutfitValidationResult,
  ValidatedOutfit,
} from "./outfit-validation";
export type {
  RecommendationScoreComponents,
  RecommendationScoreKey,
  RecommendationWeights,
} from "./weights";
