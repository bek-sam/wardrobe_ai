/**
 * The "or use email" rule between the provider buttons and the email form.
 *
 * Renders only when a provider button is actually above it. A separator with
 * nothing before it reads as a sign-in method the page failed to load, which
 * is the same misdirection `OAuthGoogleButton` avoids by rendering nothing at
 * all when its provider is switched off — so the two have to agree.
 */
export function AuthEmailDivider({ shown }: { shown: boolean }) {
  if (!shown) return null;

  return (
    <div className="auth-divider">
      <span>or use email</span>
    </div>
  );
}
