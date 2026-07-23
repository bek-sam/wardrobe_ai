import type { TodayRecommendation } from "./today.types";

export function TodayLookNotes({ recommendation }: { recommendation: TodayRecommendation }) {
  return (
    <>
      {recommendation.missingCategory ? (
        <p className="today-look__note">Missing category: {recommendation.missingCategory}</p>
      ) : null}
      {recommendation.followUpQuestion ? (
        <p className="today-look__note">{recommendation.followUpQuestion}</p>
      ) : null}
      {recommendation.excludedItemCount ? (
        <p className="today-look__note">
          {recommendation.excludedItemCount} owned
          {recommendation.excludedItemCount === 1 ? " item was" : " items were"} excluded by
          availability or context filters.
        </p>
      ) : null}
    </>
  );
}
