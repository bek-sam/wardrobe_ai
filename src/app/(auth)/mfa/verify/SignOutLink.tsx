import { SubmitButton } from "@/components/ui/SubmitButton";

export function SignOutLink() {
  return (
    <form action="/api/auth/logout" className="auth-form auth-form--inline" method="post">
      <input name="scope" type="hidden" value="local" />
      <SubmitButton pendingLabel="Signing out…" variant="secondary">
        Cancel and sign out
      </SubmitButton>
      <p className="form-field__hint">
        Lost your authenticator? Signing out is safe — contact support to have the factor removed
        after an identity check. We cannot bypass it from here.
      </p>
    </form>
  );
}
