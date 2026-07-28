import { DEFAULT_SIGNED_IN_PATH } from "@/lib/auth/constants";

import { MFA_PENDING_ROUTES, PUBLIC_ROUTES, SIGNED_OUT_ONLY_ROUTES } from "./public-routes.data";

export type RouteDecision =
  { kind: "continue" } | { kind: "redirect"; pathname: string; carryReturnTo: boolean };

export type RouteState = { signedIn: boolean; needsMfa: boolean };

/**
 * Decides where a request may go, given only the session's state.
 *
 * The MFA branch is checked before anything else a signed-in user could reach,
 * and `/mfa/verify` receives the destination as a *parameter* rather than
 * honouring it directly — so a crafted `returnTo` cannot be used to step past
 * the challenge. Route handlers under `/api` are left alone here and enforce
 * their own rules, because several of them (verifying a code, signing out)
 * exist specifically to be callable at aal1.
 */
export function resolveRoute(pathname: string, state: RouteState): RouteDecision {
  const isApi = pathname.startsWith("/api/");

  if (!state.signedIn) {
    if (isApi || PUBLIC_ROUTES.has(pathname)) return { kind: "continue" };
    return { kind: "redirect", pathname: "/login", carryReturnTo: true };
  }

  if (state.needsMfa && !isApi && !MFA_PENDING_ROUTES.has(pathname)) {
    return { kind: "redirect", pathname: "/mfa/verify", carryReturnTo: true };
  }

  if (SIGNED_OUT_ONLY_ROUTES.has(pathname)) {
    return { kind: "redirect", pathname: DEFAULT_SIGNED_IN_PATH, carryReturnTo: false };
  }

  return { kind: "continue" };
}
