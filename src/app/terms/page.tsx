import { LegalHeader } from "@/components/ui/LegalHeader";

import { TermsDocument } from "./TermsDocument";

export const metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <div className="legal-page">
      <LegalHeader />
      <main className="legal-main legal-main--narrow">
        <div className="legal-title">
          <p className="eyebrow">Private beta draft</p>
          <h1>Terms of use.</h1>
          <p>
            These draft terms describe the intended product experience. They require final legal
            review before Wardrobe AI accepts public accounts.
          </p>
        </div>
        <TermsDocument />
      </main>
    </div>
  );
}
