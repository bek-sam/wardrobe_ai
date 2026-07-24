import { ShieldCheck } from "@phosphor-icons/react/ssr";

import { LegalHeader } from "@/components/ui/LegalHeader";

import { PrivacyDocument } from "./PrivacyDocument";
import { PrivacyPrinciples } from "./PrivacyPrinciples";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <LegalHeader />
      <main className="legal-main">
        <div className="legal-title">
          <p className="eyebrow">Your wardrobe is personal</p>
          <h1>Privacy, in plain language.</h1>
          <p>
            This product is being prepared for private beta. This page states the intended data
            practices and must be reviewed against the final infrastructure before launch.
          </p>
        </div>
        <PrivacyPrinciples />
        <PrivacyDocument />
        <div className="legal-callout">
          <ShieldCheck size={20} />
          <p>
            <strong>Launch requirement</strong>This draft is transparent about its status and is not
            a substitute for legal review.
          </p>
        </div>
      </main>
    </div>
  );
}
