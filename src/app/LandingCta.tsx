import { ArrowRight } from "@phosphor-icons/react/ssr";

import { ButtonLink } from "@/components/ui/Button";

export function LandingCta() {
  return (
    <section className="landing-cta">
      <p className="eyebrow">Start with one piece</p>
      <h2>
        Make tomorrow’s outfit
        <br />
        easier tonight.
      </h2>
      <ButtonLink href="/signup">
        Create your wardrobe <ArrowRight size={16} />
      </ButtonLink>
    </section>
  );
}
