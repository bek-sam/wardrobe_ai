import { getServerEnvironment } from "@/lib/env/server";
import { AUTH_CALLBACK_PATHS, type AuthCallbackIntent } from "./constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError } from "@/lib/api/response";
import type { User, UserIdentity } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PRIVACY_VERSION, TERMS_VERSION, type LegalAcceptanceSource } from "@/constants/legal";
import { createClient } from "@/lib/supabase/server";
import { RECENT_AUTH_MAX_AGE_SECONDS } from "./constants";
import type { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_ACTION_COOKIE, AUTH_ACTION_TTL_SECONDS } from "./constants";
import { createHmac, timingSafeEqual } from "node:crypto";
import { requireEnvironment } from "@/lib/env/server";
import { randomUUID } from "node:crypto";
import { AuthenticationError } from "./auth-error";
import { RateLimitError } from "@/lib/api/response";
import { trustedClientIp } from "@/lib/api/client-ip";

/**
 * Builds an absolute URL from the *configured* application origin rather than
 * the incoming request. Email links are the reason: a forged Host header on
 * the request that triggers a recovery email would otherwise end up baked into
 * the link the real account owner receives.
 */
export function canonicalAppUrl(path: string = "/"): string {
  return new URL(path, getServerEnvironment().NEXT_PUBLIC_APP_URL).toString();
}

/**
 * The exact callback URL for one auth intent. `returnTo` is carried as a query
 * parameter and re-sanitized on arrival; it is never trusted on the way back.
 */
export function authCallbackUrl(intent: AuthCallbackIntent, returnTo?: string): string {
  const url = new URL(AUTH_CALLBACK_PATHS[intent], getServerEnvironment().NEXT_PUBLIC_APP_URL);
  if (returnTo) url.searchParams.set("returnTo", returnTo);
  return url.toString();
}

/**
 * The sign-in methods this application knows about.
 *
 * A registry rather than scattered string comparisons, so adding Apple or
 * passkeys later means one entry here plus a feature flag — not an audit of
 * every place that asks "is this the last identity?" or "can this method
 * recover an account?".
 *
 * `recoveryCapable` marks a method that can get a user back in on its own. It
 * is what stops the UI from silently unlinking someone's only route back into
 * their account.
 */
export const AUTH_PROVIDERS = {
  email: {
    id: "email",
    label: "Email and password",
    recoveryCapable: true,
    /** Linked implicitly by signing up or adding a password, never via OAuth. */
    linkable: false,
  },
  google: {
    id: "google",
    label: "Google",
    recoveryCapable: true,
    linkable: true,
  },
} as const;

export type SupportedProvider = keyof typeof AUTH_PROVIDERS;

export const SUPPORTED_PROVIDERS = Object.keys(AUTH_PROVIDERS) as SupportedProvider[];

/**
 * Narrows an untrusted string. Client requests name a provider, and anything
 * outside this list must be rejected rather than forwarded to the provider
 * API — that is what keeps `provider=saml` or a typo from reaching Supabase.
 */
export function isSupportedProvider(value: unknown): value is SupportedProvider {
  return typeof value === "string" && Object.hasOwn(AUTH_PROVIDERS, value);
}

/**
 * Application-level authentication events.
 *
 * These complement — never duplicate — Supabase's own Auth Audit Logs, which
 * already hold the provider-side record. What is recorded here is only what
 * the provider cannot see: which of *our* flows ran and how it ended.
 *
 * Everything below is a fixed enum value. Nothing derived from user input,
 * and by construction no email, password, OTP, TOTP code, OAuth code, CAPTCHA
 * token, action token, session token, storage path, or signed URL, ever
 * becomes an event type or a result.
 */
type AuthEventType =
  | "signup_requested"
  | "signup_completed"
  | "confirmation_requested"
  | "confirmation_completed"
  | "login_attempted"
  | "magic_link_requested"
  | "oauth_started"
  | "oauth_completed"
  | "recovery_requested"
  | "recovery_completed"
  | "password_changed"
  | "password_added"
  | "email_change_requested"
  | "email_change_completed"
  | "mfa_enrolled"
  | "mfa_removed"
  | "mfa_challenged"
  | "identity_linked"
  | "identity_unlinked"
  | "legal_accepted"
  | "logout"
  | "account_export"
  | "deletion_requested"
  | "deletion_auth_user_deleted"
  | "deletion_completed"
  | "storage_deletion_failed";

/** Coarse outcome. Deliberately not a provider error string. */
type AuthEventResult = "success" | "failure" | "rejected" | "throttled";

export type AuthEvent = {
  type: AuthEventType;
  result: AuthEventResult;
  /** Only when the actor is already authenticated. Never for pre-auth flows. */
  userId?: string | null;
  provider?: SupportedProvider | null;
  /** Our own stable code, e.g. `invalid_credentials`. Never a provider string. */
  reason?: string | null;
};

/**
 * Records an operational auth event.
 *
 * Fire-and-forget on purpose: an audit write must never be the reason a user
 * cannot sign in or delete their account. A failure is swallowed after a
 * code-only console line, because the alternative — surfacing it — would turn
 * a logging outage into an authentication outage.
 *
 * Pre-authentication flows (login attempts, recovery requests) pass no
 * `userId`. Resolving one would mean looking up the address, which is both an
 * enumeration oracle and a record of who tried to sign in and when.
 */
export async function recordAuthEvent(event: AuthEvent): Promise<void> {
  try {
    const { error } = await createAdminClient()
      .from("auth_events")
      .insert({
        event_type: event.type,
        result: event.result,
        user_id: event.userId ?? null,
        provider: event.provider ?? null,
        reason: event.reason ?? null,
      });
    if (error) console.error("auth_event_write_failed", { code: error.code });
  } catch {
    console.error("auth_event_write_failed", { code: "unavailable" });
  }
}

export type AuthFeatureFlags = {
  publicSignupEnabled: boolean;
  googleAuthEnabled: boolean;
  magicLinkEnabled: boolean;
  captchaEnabled: boolean;
  turnstileSiteKey: string | null;
};

/**
 * Resolves the authentication feature flags for server code. Every flag
 * defaults to off, so an unset or misspelled variable disables the feature
 * rather than exposing a half-configured one.
 *
 * CAPTCHA is the one flag that can be *inconsistently* configured: the site
 * key lives here while the secret that actually validates tokens lives in
 * Supabase. A flag set without a site key would render no widget yet still
 * demand a token, locking every user out, so it is treated as a hard
 * configuration error instead of being silently downgraded.
 */
export function getAuthFlags(): AuthFeatureFlags {
  const environment = getServerEnvironment();
  const captchaEnabled = environment.NEXT_PUBLIC_CAPTCHA_ENABLED;
  const turnstileSiteKey = environment.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null;

  if (captchaEnabled && !turnstileSiteKey) {
    throw new Error(
      "NEXT_PUBLIC_CAPTCHA_ENABLED is set without NEXT_PUBLIC_TURNSTILE_SITE_KEY. " +
        "Set the site key here and the matching secret in Supabase, or disable CAPTCHA.",
    );
  }

  return {
    publicSignupEnabled: environment.PUBLIC_SIGNUP_ENABLED,
    googleAuthEnabled: environment.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
    magicLinkEnabled: environment.NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED,
    captchaEnabled,
    turnstileSiteKey,
  };
}

/**
 * Checks that a CAPTCHA token is present and hands it back for the caller to
 * pass straight to Supabase.
 *
 * The token is **not** verified here. A Turnstile token is single-use, so
 * calling `siteverify` ourselves would burn it and Supabase's own check —
 * which is the one that actually gates the auth operation — would then fail
 * for every legitimate user. Supabase holds the secret and does the
 * verification; our job is to refuse to proceed without a token at all, so a
 * client that simply omits the field cannot skip the challenge.
 *
 * Returns `undefined` when CAPTCHA is off, which is exactly what the Supabase
 * `captchaToken` option expects for "not applicable".
 */
export function requireCaptchaToken(token: string | undefined): string | undefined {
  if (!getAuthFlags().captchaEnabled) return undefined;

  const trimmed = token?.trim();
  if (!trimmed) {
    throw new ApiError(
      400,
      "captcha_required",
      "Complete the verification challenge and try again.",
    );
  }
  return trimmed;
}

/** The only identity fields that may reach the browser. */
export type LinkedIdentity = {
  identityId: string;
  provider: SupportedProvider;
  label: string;
  recoveryCapable: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
};

/**
 * Projects Supabase identities onto our own shape.
 *
 * `identity_data` is dropped entirely: it is a raw provider payload that can
 * carry profile pictures, locales, hosted-domain hints, and provider subject
 * identifiers we have no reason to expose. Unrecognized providers are dropped
 * too — surfacing a method the app cannot actually manage would produce
 * buttons that do nothing.
 */
export function normalizeIdentities(identities: readonly UserIdentity[]): LinkedIdentity[] {
  return identities.flatMap((identity) => {
    if (!isSupportedProvider(identity.provider)) return [];
    const definition = AUTH_PROVIDERS[identity.provider];
    return [
      {
        identityId: identity.identity_id,
        provider: identity.provider,
        label: definition.label,
        recoveryCapable: definition.recoveryCapable,
        createdAt: identity.created_at ?? null,
        lastSignInAt: identity.last_sign_in_at ?? null,
      },
    ];
  });
}

export function userIdentities(user: User): LinkedIdentity[] {
  return normalizeIdentities(user.identities ?? []);
}

/** An `email` identity is the only thing that proves a password exists. */
export function hasPasswordIdentity(identities: readonly LinkedIdentity[]): boolean {
  return identities.some((identity) => identity.provider === "email");
}

/**
 * Writes the authoritative acceptance record.
 *
 * Server-side and service-role, never a client write: acceptance is evidence
 * about a user, so letting the browser assert it (via user metadata, say)
 * would make the record worth nothing. The unique key on
 * (user, terms version, privacy version) makes a retried signup or a
 * double-submitted form produce one row, not two.
 */
export async function recordLegalAcceptance(
  userId: string,
  source: LegalAcceptanceSource,
): Promise<void> {
  const { error } = await createAdminClient().rpc("record_legal_acceptance", {
    p_user_id: userId,
    p_terms_version: TERMS_VERSION,
    p_privacy_version: PRIVACY_VERSION,
    p_source: source,
  });
  // The provider's code rides along as `cause` so the route can log *why* the
  // write failed. A missing function (schema drift) and a genuine outage are
  // the same message to the user but need opposite fixes from an operator.
  if (error) throw new Error("legal_acceptance_write_failed", { cause: error.code });
}

/**
 * Whether the user has accepted the versions currently in force.
 *
 * Bumping either constant makes every existing acceptance stale, which is the
 * intended behaviour: users are re-gated at their next request instead of
 * being assumed to have agreed to text they never saw.
 *
 * Read through the caller's own client so RLS confirms ownership.
 */
export async function hasCurrentLegalAcceptance(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select("id")
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .limit(1)
    .maybeSingle();

  // An unreadable acceptance state is treated as "not accepted": the gate
  // re-prompts, which is recoverable, rather than waving the user through.
  if (error) return false;
  return data !== null;
}

export type LiveSession = { supabase: SupabaseClient; user: User };

/**
 * Resolves the caller by asking the Auth server, not by verifying the JWT we
 * were handed.
 *
 * `getClaims()` is the right tool for ordinary reads: it is a local signature
 * check, so it is fast and it cannot be forged. What it cannot see is
 * *revocation* — a token stays cryptographically valid until it expires, so a
 * session signed out on another device, an account that has since been
 * deleted, or a user banned minutes ago all still present a perfectly valid
 * token. For anything destructive or credential-changing, that window is not
 * acceptable, so this round-trips to `getUser()` and lets the server decide.
 *
 * Use `requireViewer()` for reads; use this for password/email changes,
 * identity changes, MFA changes, export, and deletion.
 */
export async function requireLiveUser(): Promise<LiveSession> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new ApiError(401, "authentication_required", "Sign in again to continue.");
  }

  return { supabase, user: data.user };
}

export type AssuranceState = {
  currentLevel: string | null;
  nextLevel: string | null;
  /** The account has at least one *verified* factor. */
  hasVerifiedFactor: boolean;
  /** Verified factor exists but this session has not satisfied it yet. */
  needsChallenge: boolean;
  /**
   * The session's `amr` claim, either as RFC-8176 strings or as objects with
   * timestamps. Timestamps drive the server-side recency check and are never
   * forwarded to the browser.
   */
  currentAuthenticationMethods: readonly (string | { method?: string; timestamp?: number })[];
};

/**
 * Reads the session's assurance level. Supabase reports `nextLevel === "aal2"`
 * exactly when the account has a verified factor, so that single comparison
 * distinguishes "no MFA on this account" from "MFA enrolled but not yet
 * satisfied on this session".
 *
 * Errors are treated as a missing session rather than as "no MFA": an
 * unreadable assurance level must never be the reason a step-up check passes.
 */
export async function getAssuranceState(supabase: SupabaseClient): Promise<AssuranceState> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    throw new ApiError(401, "authentication_required", "Sign in again to continue.");
  }

  const hasVerifiedFactor = data.nextLevel === "aal2";
  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
    hasVerifiedFactor,
    needsChallenge: hasVerifiedFactor && data.currentLevel !== "aal2",
    currentAuthenticationMethods: data.currentAuthenticationMethods ?? [],
  };
}

/**
 * Gate for sensitive actions. A user with no factor passes at AAL1 (they have
 * nothing to step up to); a user with a verified factor must have satisfied it
 * on this session.
 */
export async function requireAal2(supabase: SupabaseClient): Promise<AssuranceState> {
  const state = await getAssuranceState(supabase);
  if (state.needsChallenge) {
    throw new ApiError(403, "mfa_required", "Enter your authenticator code to continue.");
  }
  return state;
}

type AuthenticationMethod = string | { method?: string; timestamp?: number };

/**
 * Newest timestamp among the session's authentication methods, in UNIX
 * seconds, or `null` when none carries one.
 *
 * Supabase may report methods either as RFC-8176 strings (`["password"]`) or
 * as objects with timestamps. The string form proves *how* the user
 * authenticated but not *when*, so it cannot establish recency and is skipped
 * — callers must then fall back to an explicit reauthentication challenge.
 */
export function latestAuthenticationAt(methods: readonly AuthenticationMethod[]): number | null {
  let latest: number | null = null;
  for (const entry of methods) {
    if (typeof entry === "string") continue;
    const timestamp = entry.timestamp;
    if (typeof timestamp === "number" && (latest === null || timestamp > latest)) {
      latest = timestamp;
    }
  }
  return latest;
}

export function isRecentAuthentication(
  latestAt: number | null,
  now: number = Date.now(),
  maxAgeSeconds: number = RECENT_AUTH_MAX_AGE_SECONDS,
): boolean {
  if (latestAt === null) return false;
  const ageSeconds = now / 1000 - latestAt;
  // A timestamp in the future means clock skew or a tampered claim; neither is
  // evidence of a recent, deliberate authentication.
  return ageSeconds >= 0 && ageSeconds <= maxAgeSeconds;
}

/** Whether this session authenticated recently enough to skip a step-up prompt. */
export async function hasRecentAuthentication(supabase: SupabaseClient): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return isRecentAuthentication(latestAuthenticationAt(data.currentAuthenticationMethods));
}

/**
 * `SameSite=Lax`, not `Strict`, and the reason is mechanical rather than a
 * preference: a recovery link is clicked in a mail client, so the whole
 * redirect chain (mail host → Supabase verify → our callback → /reset-password)
 * is cross-site initiated. Browsers withhold `Strict` cookies for the entire
 * chain, which would make the reset page unreachable for every real user.
 *
 * `Lax` still refuses to send the cookie on cross-site POSTs and subresource
 * requests, and the protection that actually stops abuse lives elsewhere: the
 * cookie is `HttpOnly` so script cannot read it, the consuming route validates
 * `Origin`, the payload is bound to one user and one purpose, it expires in
 * ten minutes, and its nonce is consumed in the database on first use.
 */
function cookieAttributes() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: AUTH_ACTION_TTL_SECONDS,
  };
}

export function setAuthActionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_ACTION_COOKIE, token, cookieAttributes());
  return response;
}

/** Removes the cookie after use, or after any rejected attempt to use it. */
export function clearAuthActionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_ACTION_COOKIE, "", { ...cookieAttributes(), maxAge: 0 });
  return response;
}

export async function readAuthActionCookie(): Promise<string | null> {
  const store = await cookies();
  return store.get(AUTH_ACTION_COOKIE)?.value ?? null;
}

/**
 * What a challenge authorizes. A token minted for one purpose can never be
 * presented for another: the purpose is inside the signed payload and is
 * compared on every read.
 */
export type AuthActionPurpose =
  "password_reset" | "account_deletion" | "add_password" | "sensitive_change";

/**
 * The signed body of an auth action challenge.
 *
 * Deliberately absent: access tokens, refresh tokens, provider tokens, the
 * user's email, and anything else that would turn a leaked cookie into a
 * usable credential. Everything here is either an opaque identifier or a
 * timestamp, and the token alone is useless without the matching unconsumed
 * database row.
 */
export type AuthActionPayload = {
  /** Schema version, so a future format change invalidates old tokens. */
  v: 1;
  purpose: AuthActionPurpose;
  /** The user this action is bound to. */
  userId: string;
  /** Session the challenge was issued from, when the provider exposes one. */
  sessionId: string | null;
  /** Single-use identifier; the matching row is what makes replay fail. */
  nonce: string;
  /** UNIX seconds. */
  issuedAt: number;
  /** UNIX seconds. */
  expiresAt: number;
};

/**
 * HMAC-SHA-256 over a base64url payload. Signing is sufficient here and
 * encryption would be misleading: nothing in the payload is secret, it only
 * has to be unforgeable.
 */
function signature(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(body).digest();
}

export function signAuthAction(payload: AuthActionPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signature(body, secret).toString("base64url")}`;
}

/**
 * Returns the payload only when the signature verifies. Comparison is
 * constant-time so a caller cannot learn the correct signature byte by byte
 * from response timing.
 *
 * Expiry, purpose, and user binding are checked by `readAuthAction`, not here
 * — this function answers only "did we sign this?".
 */
export function verifyAuthActionSignature(token: string, secret: string): AuthActionPayload | null {
  const separator = token.indexOf(".");
  if (separator <= 0 || separator === token.length - 1) return null;

  const body = token.slice(0, separator);
  const provided = Buffer.from(token.slice(separator + 1), "base64url");
  const expected = signature(body, secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;

  try {
    const parsed: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return isAuthActionPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isAuthActionPayload(value: unknown): value is AuthActionPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === 1 &&
    typeof candidate.purpose === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.nonce === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number"
  );
}

export type AuthActionRejection =
  "missing" | "invalid_signature" | "wrong_purpose" | "wrong_user" | "expired";

export type AuthActionRead =
  { ok: true; payload: AuthActionPayload } | { ok: false; reason: AuthActionRejection };

/**
 * Validates every binding on a challenge before it may authorize anything.
 *
 * All four checks matter independently: a valid signature on a token minted
 * for a *different purpose* would let a reauthentication link authorize a
 * password change, and one minted for a *different user* is the exact shape of
 * the "reauthenticate as yourself, delete someone else" attack. Replay is
 * blocked separately, by consuming the nonce in the database.
 */
export function readAuthAction(
  token: string | null | undefined,
  secret: string,
  expected: { purpose: AuthActionPurpose; userId: string; now?: number },
): AuthActionRead {
  if (!token) return { ok: false, reason: "missing" };

  const payload = verifyAuthActionSignature(token, secret);
  if (!payload) return { ok: false, reason: "invalid_signature" };
  if (payload.purpose !== expected.purpose) return { ok: false, reason: "wrong_purpose" };
  if (payload.userId !== expected.userId) return { ok: false, reason: "wrong_user" };

  const nowSeconds = (expected.now ?? Date.now()) / 1000;
  if (payload.expiresAt <= nowSeconds) return { ok: false, reason: "expired" };

  return { ok: true, payload };
}

/**
 * Auth actions fail closed when unconfigured. Without a signing key there is
 * no way to tell a challenge we minted from one an attacker wrote, so the
 * flows that depend on it (password reset, deletion reauthentication) refuse
 * to run rather than accepting unauthenticated tokens.
 */
export function requireAuthActionSecret(): string {
  return requireEnvironment("AUTH_ACTION_SECRET").AUTH_ACTION_SECRET;
}

/**
 * Mints a challenge: a signed token for the browser plus a durable row that
 * makes it single-use. The signature alone cannot prevent replay — an attacker
 * who captured the cookie could present the same valid token twice — so the
 * database row is the authority, and it is written before the token is handed
 * out.
 */
export async function issueAuthAction(input: {
  userId: string;
  purpose: AuthActionPurpose;
  sessionId?: string | null;
}): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const payload: AuthActionPayload = {
    v: 1,
    purpose: input.purpose,
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    nonce: randomUUID(),
    issuedAt: nowSeconds,
    expiresAt: nowSeconds + AUTH_ACTION_TTL_SECONDS,
  };

  const { error } = await createAdminClient().rpc("issue_auth_action_challenge", {
    p_nonce: payload.nonce,
    p_user_id: payload.userId,
    p_purpose: payload.purpose,
    p_session_id: payload.sessionId,
    p_expires_at: new Date(payload.expiresAt * 1000).toISOString(),
  });
  if (error) throw new Error("auth_action_challenge_issue_failed");

  return signAuthAction(payload, requireAuthActionSecret());
}

/**
 * Atomically marks the challenge used. Returns false when it was already
 * consumed, has expired, or never belonged to this user and purpose — the
 * database `update ... where consumed_at is null` is what makes two concurrent
 * replays resolve to exactly one winner.
 */
export async function consumeAuthAction(input: {
  nonce: string;
  userId: string;
  purpose: AuthActionPurpose;
}): Promise<boolean> {
  const { data, error } = await createAdminClient().rpc("consume_auth_action_challenge", {
    p_nonce: input.nonce,
    p_user_id: input.userId,
    p_purpose: input.purpose,
  });
  return !error && data === true;
}

export type SensitiveActionContext = {
  supabase: SupabaseClient;
  user: User;
  assurance: AssuranceState;
};

/**
 * The common gate for anything that changes credentials or removes data:
 * a session the Auth server has just confirmed, plus the second factor when
 * the account has one.
 */
export async function requireSensitiveAction(): Promise<SensitiveActionContext> {
  const { supabase, user } = await requireLiveUser();
  const assurance = await requireAal2(supabase);
  return { supabase, user, assurance };
}

/**
 * Additionally demands that the user proved who they are *recently*.
 *
 * Satisfied either by a fresh authentication on this session, or by a
 * `sensitive_change` challenge minted by an explicit step-up flow. The second
 * path is what keeps this workable: Supabase may report authentication methods
 * without timestamps, and in that case recency cannot be established from the
 * session alone — falling back to "allow" would quietly disable the check, so
 * we require the explicit challenge instead.
 */
export async function requireRecentAuthentication(context: SensitiveActionContext): Promise<void> {
  if (await hasRecentAuthentication(context.supabase)) return;

  const challenge = readAuthAction(await readAuthActionCookie(), requireAuthActionSecret(), {
    purpose: "sensitive_change",
    userId: context.user.id,
  });
  const consumed =
    challenge.ok &&
    (await consumeAuthAction({
      nonce: challenge.payload.nonce,
      userId: context.user.id,
      purpose: "sensitive_change",
    }));

  if (!consumed) {
    throw new ApiError(403, "reauthentication_required", "Confirm it is you before continuing.");
  }
}

/**
 * The current session's identifier, taken from the verified access-token
 * claims.
 *
 * Used only to *bind* an auth action challenge to the session that requested
 * it, so a challenge minted in one session cannot be redeemed from another.
 * It is an opaque identifier, never a credential — the token itself is not
 * stored anywhere.
 *
 * Returns null when the provider does not surface the claim; callers treat
 * that as "no session binding available" and fall back to the user binding,
 * which is always present.
 */
export async function currentSessionId(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const sessionId = (data?.claims as { session_id?: unknown } | undefined)?.session_id;
  return typeof sessionId === "string" && sessionId.length > 0 ? sessionId : null;
}

export type UnlinkRefusal = "not_linked" | "last_identity" | "last_recovery_method";

export type UnlinkDecision = { allowed: true } | { allowed: false; reason: UnlinkRefusal };

/**
 * Decides whether an identity may be removed.
 *
 * Two separate guards, because they fail in different ways. Removing the
 * *last* identity would leave an account nobody — including its owner — can
 * ever sign into again; Supabase refuses this too, but relying on a provider
 * error to enforce our own account model means the UI only finds out after the
 * user has confirmed. Removing the last *recovery-capable* method is subtler:
 * the account stays reachable today, yet the moment that one credential is
 * lost there is no way back in.
 *
 * The caller is expected to have already confirmed the identity belongs to the
 * authenticated user.
 */
export function canUnlinkIdentity(
  identities: readonly LinkedIdentity[],
  identityId: string,
): UnlinkDecision {
  const target = identities.find((identity) => identity.identityId === identityId);
  if (!target) return { allowed: false, reason: "not_linked" };
  if (identities.length <= 1) return { allowed: false, reason: "last_identity" };

  if (target.recoveryCapable) {
    const otherRecovery = identities.some(
      (identity) => identity.identityId !== identityId && identity.recoveryCapable,
    );
    if (!otherRecovery) return { allowed: false, reason: "last_recovery_method" };
  }

  return { allowed: true };
}

/** Convenience for provider-named requests once the provider has been validated. */
export function identityForProvider(
  identities: readonly LinkedIdentity[],
  provider: SupportedProvider,
): LinkedIdentity | null {
  return identities.find((identity) => identity.provider === provider) ?? null;
}

export type Viewer = {
  id: string;
  email: string | null;
};

export async function getViewer(): Promise<Viewer | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const subject = claims?.sub;

  if (error || typeof subject !== "string" || subject.length === 0) {
    return null;
  }

  const email = claims?.email;
  return {
    id: subject,
    email: typeof email === "string" ? email : null,
  };
}

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) {
    throw new AuthenticationError();
  }
  return viewer;
}

export { AuthenticationError } from "./auth-error";

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

/** Bucket used when no trustworthy client IP is available for this deployment. */
export const UNKNOWN_IP_IDENTIFIER = "unknown-proxy";

function secret(): string {
  return requireEnvironment("AUTH_RATE_LIMIT_HMAC_SECRET").AUTH_RATE_LIMIT_HMAC_SECRET;
}

/**
 * Emails are lower-cased *for bucketing only*, so `A@x.test` and `a@x.test`
 * share a counter rather than doubling an attacker's budget. The address used
 * for authentication is never modified.
 */
export function normalizeRateLimitEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Turns an identifier into an opaque bucket key. The table therefore holds no
 * raw email addresses and no raw IPs — someone who reads it learns that *some*
 * address was throttled, not whose.
 *
 * The scope is part of the signed message, so the same string used as an email
 * and as a user ID produces two different buckets and cannot be made to share
 * a budget.
 */
export function rateLimitIdentifier(scope: RateLimitScope, value: string): string {
  const normalized = scope === "email" ? normalizeRateLimitEmail(value) : value.trim();
  return createHmac("sha256", secret()).update(`${scope}:${normalized}`).digest("hex");
}

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export type RateLimitSubject = { email?: string; ip?: string | null; userId?: string };

function subjectValue(rule: RateLimitRule, subject: RateLimitSubject): string | null {
  if (rule.scope === "email") return subject.email ?? null;
  if (rule.scope === "user") return subject.userId ?? null;
  // No trustworthy client IP means everyone shares one coarse bucket, which is
  // weak but honest — far better than hashing a header a client can forge and
  // calling the result per-client protection.
  return subject.ip ?? UNKNOWN_IP_IDENTIFIER;
}

/**
 * Charges every bucket for an action, stopping at the first denial so a
 * rejected request does not also burn the remaining budgets.
 *
 * Failures are treated as denials. This limiter guards the same Postgres that
 * Supabase Auth itself depends on, so an unreachable database is not a
 * situation where sign-in would otherwise be succeeding — and an abuse control
 * that silently disables itself under load is not a control.
 */
export async function consumeAuthRateLimit(
  action: AuthRateLimitAction,
  subject: RateLimitSubject,
): Promise<RateLimitDecision> {
  const admin = createAdminClient();

  for (const rule of AUTH_RATE_LIMITS[action] as readonly RateLimitRule[]) {
    const value = subjectValue(rule, subject);
    if (value === null) continue;

    const { data, error } = await admin.rpc("consume_auth_rate_limit", {
      p_action: action,
      p_identifier_hash: rateLimitIdentifier(rule.scope, value),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });
    // Code only: the identifier hash and the caller's address must not be
    // logged. Failing closed is correct, but silently is not — an unreachable
    // or broken function locks every account out and looks exactly like
    // legitimate throttling from the outside.
    if (error) {
      console.error("auth_rate_limit_unavailable", { action, scope: rule.scope, code: error.code });
      return { allowed: false, retryAfterSeconds: 60 };
    }

    const result = data as { allowed?: boolean; retry_after_seconds?: number } | null;
    if (!result?.allowed) {
      return { allowed: false, retryAfterSeconds: Math.max(1, result?.retry_after_seconds ?? 60) };
    }
  }

  return { allowed: true };
}

/**
 * Charges an action's limits and throws `RateLimitError` when any bucket is
 * exhausted. Callers run this *before* touching Supabase, sending mail, or
 * hashing a password, so a flood costs us one indexed upsert rather than a
 * provider round trip.
 */
export async function enforceAuthRateLimit(
  request: Request,
  action: AuthRateLimitAction,
  subject: Omit<RateLimitSubject, "ip"> = {},
): Promise<void> {
  const decision = await consumeAuthRateLimit(action, {
    ...subject,
    ip: trustedClientIp(request),
  });
  if (!decision.allowed) throw new RateLimitError(decision.retryAfterSeconds);
}
