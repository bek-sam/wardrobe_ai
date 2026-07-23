import { CoatHanger, MapPin, ShieldCheck } from "@phosphor-icons/react";

export function OnboardingIntro() {
  return (
    <section className="onboarding-intro">
      <p className="eyebrow">Step 2 of 3</p>
      <h1>
        Help your wardrobe
        <br />
        feel like yours.
      </h1>
      <p>
        Everything here is optional and editable later. We use it only to make recommendations more
        useful.
      </p>
      <ul>
        <li>
          <ShieldCheck size={18} /> You control every preference
        </li>
        <li>
          <CoatHanger size={18} /> Your answers improve outfit choices
        </li>
        <li>
          <MapPin size={18} /> Location powers local weather context
        </li>
      </ul>
    </section>
  );
}
