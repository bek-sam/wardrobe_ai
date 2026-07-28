# Auth production checklist

Everything below is **external configuration**. None of it is done by deploying
this repository, and nothing in the codebase can verify it on your behalf —
work through it in a real Supabase project before letting anyone sign up.

Implementation details are in [`authentication.md`](./authentication.md).

Legend: ☐ not done · ⚠️ needs a paid plan or a decision

---

## 1. Application environment

Set in your hosting provider (Vercel project settings, or equivalent). See
`.env.example` for the annotated list.

- ☐ `NEXT_PUBLIC_APP_URL` — the canonical HTTPS origin, **exactly** matching
  the Supabase Site URL. Every email link and OAuth redirect is built from it.
- ☐ `SUPABASE_SERVICE_ROLE_KEY` — server-only. Never prefix with `NEXT_PUBLIC_`.
- ☐ `AUTH_ACTION_SECRET` — `openssl rand -hex 32`.
- ☐ `AUTH_RATE_LIMIT_HMAC_SECRET` — `openssl rand -hex 32`, different from the above.
- ☐ `PUBLIC_SIGNUP_ENABLED` — `true` only when you are ready for open signups.
- ☐ `TRUSTED_CLIENT_IP_HEADER` — `x-vercel-forwarded-for` on Vercel. Leave
  unset anywhere the header could be client-supplied.
- ☐ Confirm no Google, SMTP, or Turnstile **secret** is set here. Those belong
  in Supabase.

## 2. Supabase URL configuration

Authentication → URL Configuration.

- ☐ **Site URL**: your canonical HTTPS origin, no trailing slash.
- ☐ **Redirect URLs** — add these four _exactly_, no wildcards:
  - `https://your-domain.example/auth/callback`
  - `https://your-domain.example/auth/callback/recovery`
  - `https://your-domain.example/auth/callback/magic-link`
  - `https://your-domain.example/auth/callback/reauthenticate`
- ☐ Remove any `**` wildcard entry. A production wildcard makes every
  redirect-validation control in the application moot.
- ☐ Keep `http://localhost:3000/**` and `http://127.0.0.1:3000/**` only in the
  local `supabase/config.toml`, never in the hosted project.

## 3. Email and password settings

Authentication → Providers → Email, and Authentication → Settings.

- ☐ Enable the email provider.
- ☐ **Enable email signups** — only if `PUBLIC_SIGNUP_ENABLED` is also `true`.
- ☐ **Confirm email**: on.
- ☐ **Secure email change** (double confirmation): on.
- ☐ **Secure password change**: on.
- ☐ **Minimum password length**: `15`, matching `PASSWORD_MIN_LENGTH`.
- ☐ **Password requirements**: leave empty. Length is the control; composition
  rules break password managers.
- ⚠️ **Leaked password protection**: on, if your plan supports it.

## 4. Sessions

Authentication → Sessions.

- ☐ JWT expiry: `3600` (1 hour).
- ☐ Refresh token rotation: enabled.
- ☐ Refresh token reuse interval: `10` seconds.
- ☐ Time-box user sessions (maximum lifetime): `30 days`.
- ☐ Inactivity timeout: `7 days`.
- ☐ Allow multiple concurrent sessions: yes.
- ☐ After changing these, sign in and confirm a session still refreshes
  normally rather than logging users out mid-visit.

## 5. Custom SMTP

Required for production. The built-in sender is rate-limited and not
deliverable at scale.

- ☐ Configure custom SMTP (Resend, Postmark, SES, …).
- ☐ Verified sender domain, with **SPF**, **DKIM**, and **DMARC** published.
- ☐ **Disable link tracking** at the provider. A rewritten link breaks the PKCE
  one-time code, and a scanner that "clicks" it burns the link before the user
  ever sees it.
- ☐ Customize the Confirmation, Recovery, Magic Link, Email Change, and
  Reauthentication templates.
- ☐ Send one of each to a real mailbox. Verify it arrives, is not marked spam,
  and that an expired link shows the app's own "request a new one" screen.

## 6. Google OAuth

Only if `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.

**Google Cloud console** — APIs & Services → Credentials:

- ☐ Create an **OAuth 2.0 Client ID** of type _Web application_.
- ☐ Authorized JavaScript origin: `https://your-domain.example`.
- ☐ Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
  (Supabase's callback, **not** the application's).
- ☐ OAuth consent screen: app name, logo, support email, and links to your
  published Terms and Privacy pages.
- ☐ Scopes: `openid`, `email`, `profile` only. Requesting more triggers
  verification you do not need and collects data you have no use for.

**Supabase** — Authentication → Providers → Google:

- ☐ Paste the client ID and client secret; enable the provider.
- ☐ Enable **Manual linking** (Authentication → Settings) — required by the
  "Link a Google account" control in Settings.
- ⚠️ Configure a **custom auth domain** so the consent screen shows your domain
  rather than `<project-ref>.supabase.co`. Strongly recommended: users are
  being asked to trust the name they see.

**Verify**: sign in with a fresh Google account, cancel at the consent screen
(should return a generic error, not a stack trace), then complete it and
confirm you land on onboarding with an acceptance prompt.

## 7. Cloudflare Turnstile

Only if `NEXT_PUBLIC_CAPTCHA_ENABLED=true`.

- ☐ Create a Turnstile site for your production hostname.
- ☐ Put the **site key** in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
- ☐ Put the **secret key** in Supabase → Authentication → Settings → CAPTCHA
  (provider: `turnstile`), and enable CAPTCHA protection there. Supabase is
  what validates the token; the app only requires its presence.
- ☐ Restrict the Turnstile site to your production hostname.
- ☐ Test: submit with the widget removed from the DOM (must fail), and with an
  expired token (must fail with the generic message).

## 8. Multi-factor authentication

- ⚠️ Enable **TOTP** MFA (Authentication → Settings). MFA is a paid-plan
  feature on Supabase.
- ☐ Leave phone and WebAuthn factors disabled — both are non-goals here.
- ☐ Verify the AAL behaviour end to end: enroll, sign out, sign in, confirm you
  are held at `/mfa/verify`.
- ☐ Confirm the database-level enforcement by fetching a wardrobe row directly
  from the Data API with an AAL1 token. It must return nothing.

### Runbook — a user has lost their authenticator

There are no recovery codes, so this is a manual, identity-verified process.
Restrict it to named administrators and log every use.

1. **Verify identity out of band.** Not by email alone — an attacker who
   reached this point may already control the mailbox. Use something tied to
   the account's history that an outsider could not know, or a documented
   support channel of your choosing.
2. **Confirm the request is genuine**: check the Supabase audit log for recent
   password changes, email changes, or failed MFA attempts on that account.
   A recent email change is a red flag; stop and escalate.
3. **Record the ticket** — who asked, who verified, how, and when.
4. **Remove the factor** with the service role:
   ```sql
   delete from auth.mfa_factors where user_id = '<uuid>';
   ```
5. **Notify the account's email address** that MFA was removed, so a genuine
   owner who did not ask can react.
6. **Ask the user to re-enroll immediately** at their next sign-in.
7. Consider a forced password reset as well if anything in step 2 looked off.

## 9. Operations

- ☐ Verify Auth Audit Logs are being retained (Authentication → Logs).
- ☐ Schedule the Storage-deletion worker: `POST /api/internal/storage/process`
  with the worker secret, every 5–15 minutes.
- ☐ Schedule the retention sweep: `POST /api/internal/maintenance/prune`,
  daily.
- ☐ Monitor `GET /api/internal/storage/health`. Alert on `dead_letter > 0`,
  `account_deletions_needing_attention > 0`, and a growing
  `oldest_pending_age_seconds`.
- ☐ Create the alerts listed in
  [authentication.md](./authentication.md#auth-events-and-monitoring).
- ☐ Run the Supabase **Security Advisor** and clear or consciously accept every
  finding.
- ☐ Confirm backups / PITR match your stated retention policy.
- ☐ **Test deletion with a disposable production-like account**: sign up,
  upload an image, request deletion, then verify the Auth user is gone, the
  rows are gone, the Storage objects are gone, and the audit row reads
  `complete` — not before.

## 10. Before opening signups

- ☐ Publish the Terms and Privacy pages and confirm the versions in
  `src/constants/legal.ts` match what is published.
- ☐ Confirm `NEXT_PUBLIC_APP_URL` and the Supabase Site URL are identical.
- ☐ Confirm the production CSP has no `script-src 'unsafe-inline'`
  (`curl -sI https://your-domain.example/login | grep -i content-security-policy`).
- ☐ Confirm session cookies carry `Secure` and `SameSite=Lax`.
- ☐ Confirm no secret appears in a client bundle:
  `curl -s https://your-domain.example/_next/static/chunks/*.js | grep -c "$SUPABASE_SERVICE_ROLE_KEY"`
  must be `0`.
- ☐ Set `PUBLIC_SIGNUP_ENABLED=true` and redeploy.
