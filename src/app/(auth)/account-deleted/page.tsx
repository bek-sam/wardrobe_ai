import { CheckCircle } from "@phosphor-icons/react/ssr";
import Link from "next/link";

export const metadata = { title: "Account deleted", robots: { index: false, follow: false } };

/**
 * Public confirmation page. Public on purpose: by the time a user reaches it
 * their session is gone, so anything behind authentication would bounce them
 * to a login screen for an account that no longer exists.
 *
 * The copy separates the two things that genuinely happen at different times.
 * Access and database records are gone at once; the private image files are
 * removed by a background worker over the following minutes. Saying "all your
 * files are deleted" at this moment would be false.
 */
export default function AccountDeletedPage() {
  return (
    <section className="auth-card auth-card--compact" aria-labelledby="account-deleted-title">
      <span className="auth-card__icon">
        <CheckCircle aria-hidden="true" size={24} weight="light" />
      </span>
      <div className="auth-card__intro">
        <p className="eyebrow">Account closed</p>
        <h1 id="account-deleted-title">Your account has been deleted.</h1>
      </div>
      <ul className="auth-list">
        <li>Your sign-in credentials no longer exist, and this device is signed out.</li>
        <li>Your wardrobe, outfits, plans, and conversation history have been removed.</li>
        <li>
          Your private image files are being erased from storage now. That runs in the background
          and usually finishes within minutes.
        </li>
      </ul>
      <p className="form-field__hint">
        If you asked for an export, keep the file you downloaded — we no longer hold a copy.
      </p>
      <Link className="button button--secondary button--full" href="/">
        Return to the homepage
      </Link>
    </section>
  );
}
