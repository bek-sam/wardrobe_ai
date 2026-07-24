import { ArrowRight, LockKey } from "@phosphor-icons/react/ssr";

import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";

import { LandingHeroVisual } from "./LandingHeroVisual";

export function LandingHero() {
  return (
    <section className="landing-hero">
      <div className="landing-hero__copy">
        <Badge tone="outline">Your wardrobe, understood</Badge>
        <h1>
          {"Dress for the life "}
          <br />
          you actually live.
        </h1>
        <p>
          Wardrobe AI understands what you own, what your day requires, and how you like to dress.
        </p>
        <div className="landing-hero__actions">
          <ButtonLink href="/signup">
            Create your private wardrobe <ArrowRight size={16} />
          </ButtonLink>
          <ButtonLink href="/login" variant="ghost">
            I already have an account
          </ButtonLink>
        </div>
        <p className="landing-hero__trust">
          <LockKey size={15} weight="fill" /> Private images. Account-scoped data. You approve every
          change.
        </p>
      </div>
      <LandingHeroVisual />
    </section>
  );
}
