/**
 * Pre-authentication limits, applied *before* Supabase is contacted.
 *
 * Every action is limited on two independent axes — the email being targeted
 * and the client's IP — because either one alone is trivially evaded: an
 * attacker rotating IPs still hammers one mailbox, and one IP spraying a
 * thousand addresses never trips a per-email counter.
 *
 * Windows are fixed and short. None of these produce a permanent lockout, so
 * an attacker who floods a victim's address can delay them by at most one
 * window rather than locking them out of their account indefinitely.
 */
export type RateLimitScope = "email" | "ip" | "user";

export type RateLimitRule = { scope: RateLimitScope; limit: number; windowSeconds: number };

const HOUR = 3600;
const FIFTEEN_MINUTES = 900;

export const AUTH_RATE_LIMITS = {
  signup: [
    { scope: "email", limit: 5, windowSeconds: HOUR },
    { scope: "ip", limit: 20, windowSeconds: HOUR },
  ],
  login: [
    { scope: "email", limit: 20, windowSeconds: FIFTEEN_MINUTES },
    { scope: "ip", limit: 30, windowSeconds: FIFTEEN_MINUTES },
  ],
  password_recovery: [
    { scope: "email", limit: 3, windowSeconds: HOUR },
    { scope: "ip", limit: 10, windowSeconds: HOUR },
  ],
  confirmation_resend: [
    { scope: "email", limit: 3, windowSeconds: HOUR },
    { scope: "ip", limit: 10, windowSeconds: HOUR },
  ],
  magic_link: [
    { scope: "email", limit: 5, windowSeconds: HOUR },
    { scope: "ip", limit: 15, windowSeconds: HOUR },
  ],
  // Failed step-up attempts by an already-authenticated user: keyed to the
  // account, so it cannot be used to lock anyone else out.
  reauthentication: [{ scope: "user", limit: 5, windowSeconds: FIFTEEN_MINUTES }],
} as const satisfies Record<string, readonly RateLimitRule[]>;

export type AuthRateLimitAction = keyof typeof AUTH_RATE_LIMITS;
