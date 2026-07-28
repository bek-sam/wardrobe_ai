# Authentication and account security

How a person gets into Wardrobe AI, what protects them once they are in, and
where each control actually lives. Production configuration steps are in
[`auth-production-checklist.md`](./auth-production-checklist.md); this document
describes the implementation.

## Contents

- [Sign-in methods](#sign-in-methods)
- [Feature flags](#feature-flags)
- [Password policy](#password-policy)
- [Email confirmation and delivery](#email-confirmation-and-delivery)
- [Password recovery and change](#password-recovery-and-change)
- [Google OAuth](#google-oauth)
- [Magic-link sign-in](#magic-link-sign-in)
- [Two-factor authentication](#two-factor-authentication)
- [Sessions, cookies, and sign-out](#sessions-cookies-and-sign-out)
- [Legal acceptance](#legal-acceptance)
- [Abuse controls](#abuse-controls)
- [Account export](#account-export)
- [Account deletion](#account-deletion)
- [Auth events and monitoring](#auth-events-and-monitoring)
- [Local development and testing](#local-development-and-testing)
- [Secret rotation](#secret-rotation)
- [Known limitations](#known-limitations)

## Sign-in methods

| Method           | Flag                                   | Creates accounts | Notes                                              |
| ---------------- | -------------------------------------- | ---------------- | -------------------------------------------------- |
| Email + password | `PUBLIC_SIGNUP_ENABLED` (signup only)  | Yes              | Requires email confirmation before first use.      |
| Google OAuth     | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`      | Yes              | PKCE. Only `openid email profile` is requested.    |
| Magic link       | `NEXT_PUBLIC_EMAIL_MAGIC_LINK_ENABLED` | **No**           | `shouldCreateUser: false`; existing accounts only. |

Anything switched off is **absent from the interface**, not rendered disabled.
A permanently greyed-out "Continue with Google" advertises a method that does
not exist; `/magic-link` returns a 404 when its flag is off.

Every one of these satisfies the _first_ factor only. An account with a
verified TOTP factor still lands on `/mfa/verify` afterwards — including via a
magic link, which is otherwise an obvious way to sidestep a second factor.

## Feature flags

Flags are resolved server-side by `getAuthFlags()` (`src/lib/auth/flags.ts`)
and default to **off**, so an unset or misspelled variable disables a feature
rather than half-enabling it.

`PUBLIC_SIGNUP_ENABLED` is enforced in `/api/auth/signup`, not just in the
form: a client can post the form directly, so the flag has to be checked where
the account would actually be created.

CAPTCHA is the one flag that can be _inconsistently_ configured, because the
site key lives here and the secret lives in Supabase. `NEXT_PUBLIC_CAPTCHA_ENABLED`
without `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a hard startup error — a flag that
demands a token while rendering no widget would lock every user out.

## Password policy

Defined once in `src/lib/auth/constants.ts` and enforced by
`src/features/auth/schemas.ts`.

- **Minimum 15 Unicode code points.** Counted as code points, so an emoji
  counts once, the way the user sees it.
- **Maximum 200 characters**, comfortably above the 128 a password manager may
  generate. The cap exists only to stop a huge body reaching the hashing path.
- **No composition rules.** No required symbol, digit, or capital: those push
  people toward predictable substitutions and break password managers, while
  length is what actually resists guessing.
- **Spaces are allowed and passwords are never mutated.** No trimming, no
  lowercasing, no Unicode normalization — the bytes typed are the bytes
  verified. A trailing space from a password manager is part of the secret.
- **Confirmation field** on every flow that sets a password, compared on the
  server as well as in the browser.
- `autocomplete` is always explicit: `new-password` when choosing one,
  `current-password` when proving one, `one-time-code` for TOTP.

Sign-in deliberately does **not** apply the minimum
(`existingPasswordSchema`): accounts that predate the current policy must still
be able to reach the flow that lets them change it.

Supabase's own `minimum_password_length` is kept in step (15) so a request that
somehow bypassed our schema still cannot set a weak password. Leaked-password
protection is a hosted setting — see the production checklist.

We never call Have I Been Pwned from application code with a user's password.

## Email confirmation and delivery

Password accounts must confirm before normal use. The flow is:

1. `/api/auth/signup` calls `signUp` with `emailRedirectTo` pointing at the
   canonical `/auth/callback?returnTo=/onboarding`.
2. The user lands on `/check-email`, which never contains the address in its
   URL — that would leak it into history, logs, and `Referer`.
3. `/check-email` also hosts the resend form, which answers identically whether
   the address is unknown, already confirmed, or genuinely pending.

Signing up for an address that already exists returns a decoy user with no
identities. That path is treated as an ordinary success and writes no
acceptance record, because any difference in behaviour would turn signup into
an account-existence oracle.

All redirect URLs are built from `NEXT_PUBLIC_APP_URL` by
`src/lib/auth/app-url.ts`, never from the incoming request — a forged `Host`
header would otherwise end up baked into the link the real owner receives.

## Password recovery and change

The recovery flow has its **own callback**, `/auth/callback/recovery`, and that
separation is the security property. Redeeming a recovery code produces a
signed-in session, which on its own would already be enough to change a
password — so an ordinary confirmation link, the most widely forwarded thing we
send, must not be redeemable for one.

The recovery callback instead mints a one-time challenge
(`src/lib/auth/action-challenges`):

- HMAC-SHA-256 signed with `AUTH_ACTION_SECRET`, compared in constant time.
- Bound to user id, purpose (`password_reset`), issue time, a 10-minute
  expiry, and a nonce.
- Carries **no** access token, refresh token, or provider token.
- Stored in an `HttpOnly`, `Secure`-in-production, `SameSite=Lax` cookie, with
  the nonce recorded in `auth_action_challenges` so it is genuinely single-use.

`SameSite=Lax` rather than `Strict` is deliberate and mechanical: a recovery
link is clicked in a mail client, so the whole redirect chain is cross-site
initiated and browsers withhold `Strict` cookies for all of it. What actually
stops abuse is elsewhere — `HttpOnly`, the `Origin` check on the POST, the
user/purpose binding, the short expiry, and the database nonce.

`/api/auth/reset-password` consumes the nonce **before** writing the new
password, so a double submit or a replayed cookie cannot both take effect, then
signs out every session globally and returns the user to the login screen.

**Authenticated change** (`/api/auth/change-password`) requires a live
`getUser()`, AAL2 when a factor is enrolled, a per-user rate limit, and the
current password — verified through a throwaway client
(`src/lib/supabase/verifier.ts`) so the check cannot disturb the caller's own
session. Other sessions are revoked on success.

**Adding a password to an OAuth-only account** (`/api/auth/add-password`) is an
`updateUser` on the existing user, never a `signUp` — creating a second account
for an address that already has one is the failure to avoid. It additionally
requires a recent proof of identity and a confirmed email address.

## Google OAuth

Initiated by a **same-origin POST** to `/api/auth/oauth/google` rather than a
client-side redirect, so the flow gets the CSRF origin check, the server-side
flag, and `returnTo` sanitizing before the browser leaves.

- Scopes: exactly `openid email profile`. The app never calls a Google API, so
  it never requests offline access and never receives a provider refresh token
  it would then have to protect.
- `skipBrowserRedirect: true`, because this runs on the server; the route emits
  its own redirect to the URL Supabase returned. That URL is the only external
  destination the application ever emits.
- Three intents share the route: `signin`, `link` (attach Google to an existing
  account), and `reauthenticate` (step up before deletion, with
  `prompt=select_account consent` so it cannot pass silently).
- Supabase's automatic linking for a verified matching email is left enabled.

After the callback the user is resolved with `getUser()`, then routed by
`destinationAfterFirstFactor`: MFA challenge first, then legal acceptance, then
the sanitized destination.

## Magic-link sign-in

Optional, off by default, and existing-users-only. Without
`shouldCreateUser: false`, "sign in with a link" quietly becomes a second
signup path that bypasses the signup flag, the Terms checkbox, and the
acceptance record.

The response is always "If an eligible account exists…", and the link lands on
`/auth/callback/magic-link`, which still routes an enrolled account to the MFA
challenge.

## Two-factor authentication

TOTP only. SMS and WebAuthn/passkeys are explicit non-goals.

**Enrollment** (`/api/auth/mfa/enroll`) returns the QR code, the manual setup
key, and the issuer/account label. The factor Supabase creates is _unverified_
and changes nothing about the account until a code is verified, so an abandoned
enrollment leaves an inert row. The secret is shown once, is never written to
our database or logs, and no route can read it back.

**Verification** (`/api/auth/mfa/verify`) uses `challengeAndVerify`, so the
challenge id never travels through a URL or form field. This route must **not**
require AAL2 — it is the route a user reaches precisely because they are still
at AAL1.

**Unenrollment** (`/api/auth/mfa/unenroll`) requires AAL2 and an explicit
confirmation. Someone holding a stolen password but not the authenticator must
not be able to strip the control that is stopping them.

### Enforcement is at the database, not the interface

Redirecting an under-assured session to `/mfa/verify` protects the UI and
nothing else: the access token issued after the first factor is a perfectly
valid `authenticated` credential, so anyone holding one could talk straight to
PostgREST or the Storage API.

Migration `202607280002_mfa_assurance_enforcement.sql` closes that:

- `public.mfa_requirement_satisfied()` — security definer, empty
  `search_path`, executable only by `authenticated`. Returns true when there is
  no `auth.uid()` (workers), true when the user has no verified factor, and
  otherwise requires `aal2` in the JWT.
- A **restrictive** policy named `require_mfa_assurance` on every user-owned
  table in an explicit, reviewed list, and on `storage.objects` scoped to the
  five private buckets. Restrictive policies are ANDed with the existing owner
  policies, so this can only subtract access.

`tests/integration/mfa-assurance-rls.test.ts` enrolls a factor for real, then
signs in again to obtain an AAL1 token and points it directly at PostgREST and
Storage.

**Recovery codes do not exist.** The installed SDK exposes no stable API for
them, and advertising codes that are not genuinely implemented would be worse
than having none. The UI says so before a user enrolls, and the operator
runbook for a lost authenticator is in the production checklist.

## Sessions, cookies, and sign-out

Recommended hosted settings (see the checklist to apply them):

| Setting                      | Value      |
| ---------------------------- | ---------- |
| JWT expiry                   | 1 hour     |
| Refresh-token rotation       | Enabled    |
| Refresh-token reuse interval | 10 seconds |
| Maximum session lifetime     | 30 days    |
| Inactivity timeout           | 7 days     |
| Multiple concurrent sessions | Allowed    |

One cookie configuration (`src/lib/supabase/cookie-options.ts`) is shared by the
proxy, server, and browser clients: `Path=/`, `SameSite=Lax`,
`Secure` in production, **no** `Domain`, and no `maxAge`.

The cookie is deliberately **not** `HttpOnly`, and this application must never
describe it as such. The browser Supabase client reads these tokens directly in
order to sign URLs against the private Storage buckets without proxying every
image through the app. That is an accepted architectural tradeoff: it means a
script injection could read the session, which is exactly why the production
CSP removes `script-src 'unsafe-inline'` and pins every source to an exact
origin.

Cookie lifetime is not used as a stand-in for session expiry. Shortening it
would sign users out early while leaving an already-issued refresh token just as
valid; session length is enforced server-side.

`/api/auth/logout` takes a validated scope:

| Scope                          | Ends this device | Ends other devices |
| ------------------------------ | ---------------- | ------------------ |
| `local` (the plain "Sign out") | Yes              | No                 |
| `others`                       | No               | Yes                |
| `global`                       | Yes              | Yes                |

A failed remote revocation is never reported as a clean sign-out; the local
session is still dropped when that was the intent, and the user is told plainly
that other sessions may have survived. Revocation invalidates refresh tokens
immediately, but an access token already in flight stays valid until it expires
(one hour) — the copy says so rather than implying instant global effect.

Session controls live in Settings → Security & sign-in, and a plain "Sign out"
is in the desktop sidebar and the mobile top bar. Supabase exposes no stable
per-session listing or revocation API in the installed SDK, so the UI offers
the three supported scopes rather than a device list; we do not mutate
`auth.sessions` directly.

## Legal acceptance

`legal_acceptances` records which document versions a user accepted, keyed by
`(user_id, terms_version, privacy_version)`. Versions live in
`src/constants/legal.ts`; bumping either re-gates every account at its next
request.

The record is written server-side through a service-role RPC. Client-set
metadata is never treated as evidence of consent — a user can write their own
metadata, which would make the record an assertion by the very party it binds.

Users can read their own history and nothing else. There is no insert, update,
or delete policy at all, so history is append-only.

The gate lives in `src/app/(app)/layout.tsx` rather than the proxy, because it
needs a database read and the proxy runs on every request. A Google signup, an
account created directly in Supabase, or any account after a version bump is
sent to `/accept-terms` before wardrobe data renders. The MFA check runs first,
so an under-assured session never reaches the acceptance screen.

Acceptance is included in the account export. No IP address or user agent is
stored: neither is needed to prove which text was accepted, and storing them
would make a consent record into a tracking record.

## Abuse controls

### Pre-authentication rate limiting

Applied **before** Supabase is contacted, so a flood costs one indexed upsert
rather than a provider round trip. Limits are per action, on two independent
axes, because either alone is trivially evaded:

| Action                    | Per email                 | Per IP      |
| ------------------------- | ------------------------- | ----------- |
| Signup                    | 5 / hour                  | 20 / hour   |
| Login                     | 20 / 15 min               | 30 / 15 min |
| Password recovery         | 3 / hour                  | 10 / hour   |
| Confirmation resend       | 3 / hour                  | 10 / hour   |
| Magic link                | 5 / hour                  | 15 / hour   |
| Step-up / deletion reauth | 5 / 15 min (per **user**) | —           |

Identifiers are HMAC-SHA-256 under `AUTH_RATE_LIMIT_HMAC_SECRET`, with the
scope in the signed message, so the table holds no raw email or IP and the same
string cannot share a budget across axes. Emails are lower-cased for bucketing
only.

Windows are fixed and short, so no limit becomes a permanent lockout: flooding
a victim's address delays them by at most one window. The step-up limit is
keyed to the account precisely so it cannot be used against anyone else.

Exhaustion returns HTTP 429 with `Retry-After` and one stable, identical
message. Counts and bucket identities are never disclosed — that would let an
attacker pace requests to stay just under the threshold.

The limiter **fails closed**. It guards the same Postgres that Supabase Auth
depends on, so an unreachable database is not a situation where sign-in would
otherwise be succeeding.

### Client IP

Only read from a header the deployment explicitly names in
`TRUSTED_CLIENT_IP_HEADER`, and only one the reverse proxy _overwrites_
(`x-vercel-forwarded-for` on Vercel). Unset means IP buckets collapse to a
single shared "unknown proxy" bucket — weaker, but honest. Reading
`X-Forwarded-For` unconditionally would let an attacker mint a fresh bucket per
request, which is worse than no IP limiting because it looks like protection.

### CAPTCHA

Cloudflare Turnstile, feature-flagged, protecting signup, login, password
recovery, confirmation resend, and magic link.

The token is **not** verified by this application. A Turnstile token is
single-use, so calling `siteverify` ourselves would burn it and Supabase's own
check — the one that actually gates the operation — would then fail for every
legitimate user. Supabase holds the secret and does the verification; our job
is to refuse to proceed without a token at all, so removing the widget in the
browser fails the submission rather than bypassing it.

The CSP adds `https://challenges.cloudflare.com` to `script-src`, `connect-src`,
and `frame-src` only when the flag is on.

## Account export

`POST /api/account/export` is treated as a sensitive action: live `getUser()`,
AAL2 when enrolled, origin validation, and `Cache-Control: no-store` — the
response body is the user's entire wardrobe, sizes, location, and history.

Schema version **2** adds, alongside the existing relational data:

- `account`: user id, confirmed email and its timestamp, account creation time,
  last sign-in, provider names with their creation/last-sign-in timestamps, and
  an `mfa_enabled` boolean.
- `legal_acceptances`: the full consent history.

Excluded by construction — every field is named individually rather than spread
from the provider's user object: access/refresh tokens, provider tokens, TOTP
secrets, raw identity payloads, password hashes, and auth audit secrets.

Storage is exported as paths and metadata, not bytes. That is unchanged and
intentional.

## Account deletion

Reauthentication depends on what the account actually has. "Has an email claim"
is never treated as "has a password" — a Google-only account has an email and
no password, and demanding one made deletion impossible for those users.

| Account                   | Proof required                                         |
| ------------------------- | ------------------------------------------------------ |
| Password                  | Current password, verified immediately before deletion |
| Google                    | Google round trip with `prompt=select_account consent` |
| Passwordless              | One-time email link (`shouldCreateUser: false`)        |
| Any of the above with MFA | The above **plus** AAL2                                |

For the provider paths, a `sensitive_change` challenge is minted _before_ the
redirect and the returning identity is compared against it. Without that
comparison, authenticating as any account at the provider would satisfy a
deletion started by a different one. The callback then issues a one-time
`account_deletion` authorization, consumed by `DELETE /api/account`.

### States

```
requested → storage_deletion_queued → deleting_auth_user
          → auth_deleted_storage_pending → complete
                                         ↘ failed
```

`complete` means all three of: the Auth identity is deleted, the relational
cascade has run, and every queued Storage object is gone. Nothing else may
claim it. After the Admin API call, `mark_account_deletion_auth_deleted()`
picks the honest state: `complete` only when nothing was queued, otherwise
`auth_deleted_storage_pending`.

The worker calls `complete_storage_deletion_task()`, which marks the object
gone _and_ closes the parent request when it was the last outstanding one — in
one statement, so a worker that dies between two separate writes cannot leave
an account marked fully deleted while files remain.

Failures retry with exponential backoff up to **8 attempts** (roughly four
hours), then dead-letter: the row leaves the claim predicate so it stops
consuming worker capacity, and the parent deletion is flagged
`attention_required` rather than quietly closed.

The UI reflects this. `/account-deleted` says access and records are gone
immediately and private files are being erased in the background — because at
the moment the button is pressed, that is the truth.

Retention: completed deletion records and completed queue rows are pruned after
30 days by `prune_completed_account_deletions()`. Dead-lettered rows and
deletions needing attention are never pruned.

## Auth events and monitoring

Supabase Auth Audit Logs hold the provider-side record. `auth_events` adds only
what the provider cannot see: which of _our_ flows ran and how it ended.

Each row carries a fixed enum event type, a coarse result
(`success | failure | rejected | throttled`), an optional internal user id, a
provider name, and one of our own stable reason codes. Pre-authentication flows
record **no** user id — resolving one from a submitted address would create
both an enumeration oracle and a log of who tried to sign in.

Never recorded: email addresses, passwords, OTP or TOTP codes, OAuth codes,
CAPTCHA tokens, action tokens, session tokens, private object paths, signed
URLs, or provider payloads.

Writes are fire-and-forget: a logging outage must never become an
authentication outage.

`GET /api/internal/storage/health` (worker secret) reports aggregate deletion
health. Recommended alerts:

- Login-failure spikes, and recovery-email spikes (either suggests spraying).
- Confirmation-email delivery failures (deliverability regression).
- Repeated deletion-reauthentication failures for one user.
- `dead_letter` above zero, or `account_deletions_needing_attention` above zero.
- `oldest_pending_age_seconds` growing past a worker cycle — the scheduler has
  stopped.
- Anomalous auth provider errors in the Supabase audit log.

## Local development and testing

```bash
npx supabase start          # Postgres, Auth, Storage, and Mailpit
npx supabase db reset       # applies every migration in order
npm run dev
```

`supabase/config.toml` turns on email confirmations, TOTP MFA, manual identity
linking, double-confirmed email changes, and the 15-character minimum locally,
so these flows are genuinely exercised rather than skipped in development.

Read outbound email at <http://127.0.0.1:54324>. `tests/e2e/mailpit.ts` drives
it for the E2E suite.

```bash
npm test                    # unit
npm run test:integration    # real local Supabase: RLS, MFA, rate limits, deletion
npm run test:e2e            # Playwright, real UI + Mailpit
```

Google OAuth and CAPTCHA are covered by contract and unit tests; neither needs
a live third-party credential in CI.

## Secret rotation

| Secret                        | Where it lives           | Effect of rotating                                                             |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `AUTH_ACTION_SECRET`          | This app                 | Invalidates in-flight reset and deletion challenges. Users request a new link. |
| `AUTH_RATE_LIMIT_HMAC_SECRET` | This app                 | Resets every active rate-limit window. Prune `auth_rate_limits` afterwards.    |
| `SUPABASE_SERVICE_ROLE_KEY`   | This app (server only)   | Rotate in Supabase, then redeploy. Workers fail until updated.                 |
| Google client secret          | Supabase provider config | Rotate in Google, paste into Supabase. No app change.                          |
| Turnstile secret              | Supabase CAPTCHA config  | Rotate in Cloudflare, paste into Supabase. Site key may stay.                  |
| SMTP credentials              | Supabase SMTP config     | No app change.                                                                 |

Rotate one at a time and confirm the affected flow before moving on.

## Known limitations

- **No recovery codes.** A lost authenticator needs the operator runbook.
- **No per-session device list.** The installed SDK exposes no stable API for
  it, and we will not mutate `auth.sessions` directly.
- **Session tokens are readable by script**, by design — see
  [Sessions, cookies, and sign-out](#sessions-cookies-and-sign-out).
- **Security-definer RPCs bypass the MFA RLS predicate**, because they run as
  their owner. The destructive ones (`start_account_deletion`,
  `mark_account_deletion_auth_pending`) carry an explicit
  `mfa_requirement_satisfied()` check; the rest are gated at the route layer.
  An AAL1 token for an enrolled account still cannot read or write any table or
  Storage object directly.
- **`TRUSTED_CLIENT_IP_HEADER` unset means coarse IP limiting.** Email and
  per-user buckets are unaffected.
- Phone auth, SMS MFA, Apple sign-in, SAML SSO, anonymous accounts, security
  questions, and forced password rotation are deliberate non-goals.
