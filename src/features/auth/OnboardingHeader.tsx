import { Check } from "@phosphor-icons/react";
import Link from "next/link";

import { BrandMark } from "@/components/ui/BrandMark";

export function OnboardingHeader() {
  return (
    <header className="onboarding-header">
      <BrandMark />
      <div className="onboarding-progress" aria-label="Onboarding progress">
        <span className="is-complete">
          <Check size={12} weight="bold" />
        </span>
        <span className="is-current">2</span>
        <span>3</span>
        <small>Style profile</small>
      </div>
      <Link href="/today">Skip for now</Link>
    </header>
  );
}
