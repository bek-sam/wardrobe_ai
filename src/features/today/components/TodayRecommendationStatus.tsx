import { SpinnerGap } from "@phosphor-icons/react";

export function TodayRecommendationStatus({
  coreLoading,
  generating,
}: {
  coreLoading: boolean;
  generating: boolean;
}) {
  if (coreLoading) {
    return (
      <section className="today-recommendation-status" aria-busy="true" role="status">
        <SpinnerGap className="spin" size={30} aria-hidden="true" />
        <div>
          <h2>Loading your wardrobe…</h2>
          <p>Recent items and today’s recommendation controls will appear when loading finishes.</p>
        </div>
      </section>
    );
  }
  if (generating) {
    return (
      <section className="today-recommendation-status" aria-busy="true" role="status">
        <SpinnerGap className="spin" size={30} aria-hidden="true" />
        <div>
          <h2>Building today’s look…</h2>
          <p>The stylist is filtering your owned, available pieces against today’s context.</p>
        </div>
      </section>
    );
  }
  return null;
}
