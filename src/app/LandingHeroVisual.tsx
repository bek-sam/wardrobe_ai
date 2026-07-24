import { CalendarCheck, Sparkle } from "@phosphor-icons/react/ssr";

import { GarmentArtwork } from "@/features/wardrobe/components/GarmentArtwork";

export function LandingHeroVisual() {
  return (
    <div className="landing-hero__visual" aria-label="Illustrative outfit recommendation preview">
      <p className="landing-hero__visual-label">Illustrative preview</p>
      <div className="landing-look">
        <div className="landing-look__weather">
          <span>Tomorrow · Chicago</span>
          <strong>61°</strong>
        </div>
        <div className="landing-look__pieces">
          <GarmentArtwork category="top" color="#d8d1c2" accent="#23344b" />
          <GarmentArtwork category="bottom" color="#313a45" />
          <GarmentArtwork category="layer" color="#86624d" />
          <GarmentArtwork category="shoes" color="#342f2a" />
        </div>
        <div className="landing-look__caption">
          <p>Workday ease</p>
          <span>Light layers · rain-ready</span>
        </div>
      </div>
      <div className="landing-note landing-note--one">
        <Sparkle size={16} /> Built from your closet
      </div>
      <div className="landing-note landing-note--two">
        <CalendarCheck size={16} /> Ready for tomorrow
      </div>
    </div>
  );
}
