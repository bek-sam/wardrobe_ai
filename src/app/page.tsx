import { PublicHeader } from "@/components/navigation/PublicHeader";

import { LandingCta } from "./LandingCta";
import { LandingFooter } from "./LandingFooter";
import { LandingHero } from "./LandingHero";
import { LandingPrivacy } from "./LandingPrivacy";
import { LandingSteps } from "./LandingSteps";

export default function LandingPage() {
  return (
    <div className="public-page">
      <PublicHeader />
      <main>
        <LandingHero />
        <LandingSteps />
        <LandingPrivacy />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
