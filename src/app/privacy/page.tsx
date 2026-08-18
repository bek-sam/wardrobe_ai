import { Eye, LockKey, ShieldCheck, Trash } from "@phosphor-icons/react/ssr";

import { LegalHeader } from "@/components/ui";

export const metadata = { title: "Privacy" };

function PrivacyDocument() {
  return (
    <article className="legal-document">
      <section>
        <h2>What we expect to collect</h2>
        <p>
          Account information, optional profile and size preferences, wardrobe metadata, images you
          choose to upload, saved outfits, plans, feedback, and wear history. Sensitive profile
          fields are optional.
        </p>
      </section>
      <section>
        <h2>How AI is used</h2>
        <p>
          Selected images and wardrobe context may be sent to configured AI providers to analyze
          garments, create approved image edits, research products, and build outfit
          recommendations. Hidden model reasoning is not stored.
        </p>
      </section>
      <section>
        <h2>Location and weather</h2>
        <p>
          When enabled, approximate coordinates and dates are used to retrieve weather context.
          Location can be edited or removed in Settings.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can correct AI metadata, decline modeled previews, remove original images while
          preserving manual details, export your data, and request account deletion.
        </p>
      </section>
      <section>
        <h2>Before private beta</h2>
        <p>
          The final policy will identify data processors, retention periods, contact details,
          regional rights, and the production deletion timeline.
        </p>
      </section>
    </article>
  );
}

function PrivacyPrinciples() {
  return (
    <div className="legal-principles">
      <article>
        <LockKey size={23} />
        <h2>Private storage</h2>
        <p>
          Wardrobe photos and generated images are intended to remain private and accessible only
          through short-lived links.
        </p>
      </article>
      <article>
        <Eye size={23} />
        <h2>Visible controls</h2>
        <p>
          AI suggestions remain proposals until you confirm them. Research claims include their
          sources and confidence.
        </p>
      </article>
      <article>
        <Trash size={23} />
        <h2>Your right to leave</h2>
        <p>
          Export and account deletion controls are part of the required launch scope, including
          associated files.
        </p>
      </article>
    </div>
  );
}

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
