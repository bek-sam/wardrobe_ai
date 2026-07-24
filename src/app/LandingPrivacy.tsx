import { ArrowRight, LockKey } from "@phosphor-icons/react/ssr";
import Link from "next/link";

export function LandingPrivacy() {
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
