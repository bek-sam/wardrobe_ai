import { TodayLookArt } from "./TodayLookArt";
import { TodayLookDetails } from "./TodayLookDetails";

export function TodayLook() {
  return (
    <section className="today-look" aria-labelledby="today-look-title">
      <TodayLookArt />
      <TodayLookDetails />
    </section>
  );
}
