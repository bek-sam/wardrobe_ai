import { Eye, LockKey, Trash } from "@phosphor-icons/react/ssr";

export function PrivacyPrinciples() {
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
