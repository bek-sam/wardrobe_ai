import { ArrowRight, CloudRain, CoatHanger, Sparkle } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { PublicHeader } from "@/components/navigation";
import { ButtonLink } from "@/components/ui";
import { LockKey } from "@phosphor-icons/react/ssr";
import { CalendarCheck } from "@phosphor-icons/react/ssr";
import { GarmentArtwork } from "@/components/garments/GarmentArtwork";
import { Badge } from "@/components/ui";

function LandingHeroVisual() {
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

function LandingHero() {
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

function LandingPrivacy() {
  return (
    <section className="landing-private">
      <div className="landing-private__mark">
        <LockKey size={42} weight="light" />
      </div>
      <div>
        <p className="eyebrow">Private by default</p>
        <h2>
          Your closet is personal.
          <br />
          It should stay that way.
        </h2>
      </div>
      <div className="landing-private__copy">
        <p>
          Images remain private, files use short-lived access links, and your wardrobe is isolated
          to your account.
        </p>
        <Link href="/privacy">
          Read our privacy approach <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}

const steps = [
  {
    number: "01",
    icon: CoatHanger,
    title: "Build your private closet",
    copy: "Add pieces by photo or by hand. Review every AI suggestion before it becomes part of your wardrobe.",
  },
  {
    number: "02",
    icon: CloudRain,
    title: "Add the day’s context",
    copy: "Wardrobe AI considers weather, occasion, comfort, availability, and the way you prefer to dress.",
  },
  {
    number: "03",
    icon: Sparkle,
    title: "Get a look you can wear",
    copy: "Receive a complete outfit made only from pieces you own, with useful swaps when plans change.",
  },
] as const;

function LandingSteps() {
  return (
    <section className="landing-intro" id="how-it-works">
      <p className="eyebrow">A quieter way to get dressed</p>
      <h2>Your clothes become a useful system, not another gallery to maintain.</h2>
      <div className="landing-steps">
        {steps.map(({ number, icon: Icon, title, copy }) => (
          <article key={number}>
            <div>
              <span>{number}</span>
              <Icon size={25} weight="light" aria-hidden="true" />
            </div>
            <h3>{title}</h3>
            <p>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function LandingCta() {
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

function LandingFooter() {
  return (
    <footer className="public-footer">
      <span>Wardrobe AI</span>
      <p>Thoughtful technology for the clothes you already own.</p>
      <nav aria-label="Legal links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}

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
