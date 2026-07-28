import Link from "next/link";

import { SubmitButton } from "@/components/ui/SubmitButton";

export function AcceptTermsForm({ returnTo }: { returnTo: string }) {
  return (
    <form action="/api/auth/legal/accept" className="auth-form" method="post">
      <input name="returnTo" type="hidden" value={returnTo} />
      <label className="check-row">
        <input name="acceptedTerms" required type="checkbox" value="yes" />{" "}
        <span>
          I accept the <Link href="/terms">Terms</Link> and have read the{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </span>
      </label>
      <SubmitButton pendingLabel="Saving…">Accept and continue</SubmitButton>
      <p className="form-field__hint">
        Prefer not to accept? You can{" "}
        <Link href="/settings">export or delete your account data</Link> instead.
      </p>
    </form>
  );
}
