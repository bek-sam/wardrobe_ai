/**
 * Provider method names from the `amr` claim, in the words a user recognises.
 *
 * Kept as a lookup rather than shown raw: "otp" and "totp" differ by one
 * character and mean entirely different things — an emailed link versus an
 * authenticator code — which is exactly the distinction someone auditing their
 * own session needs to be able to make.
 */
export const SESSION_METHOD_LABELS: Record<string, string> = {
  password: "signed in with a password",
  otp: "signed in with an email link",
  magiclink: "signed in with an email link",
  oauth: "signed in with Google",
  totp: "confirmed with an authenticator code",
  mfa: "confirmed with a second factor",
};

export function describeSessionMethods(methods: readonly string[]): string {
  const labelled = methods.map((method) => SESSION_METHOD_LABELS[method]).filter(Boolean);
  return labelled.length > 0 ? labelled.join(", ") : "sign-in method unavailable";
}
