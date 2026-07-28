-- Wardrobe AI: authentication and account-security foundations.
--
-- Additive only. Four new tables, each deny-by-default from the moment it is
-- created, plus the RPCs that own their write paths:
--
--   * legal_acceptances       versioned, authoritative Terms/Privacy consent
--   * auth_action_challenges  one-time nonces behind password reset and
--                             deletion reauthentication
--   * auth_rate_limits        pre-authentication abuse buckets keyed by HMAC,
--                             never by a raw email address or IP
--   * auth_events             coarse operational auth events (no secrets)
--
-- Every write here goes through a security-definer function with a fixed empty
-- search_path, executable only by service_role. The application's server-only
-- admin client is the sole caller; `anon` and `authenticated` cannot reach any
-- of it, so a compromised browser token cannot mint a reset challenge, clear a
-- rate-limit bucket, or forge an acceptance record.

set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Legal acceptance
-- ---------------------------------------------------------------------------

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  -- Coarse provenance only. Deliberately no IP address and no user agent:
  -- neither is needed to prove which text was accepted, and storing them
  -- would make this consent record itself a tracking record.
  source text not null,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_acceptances_source_check
    check (source in ('signup', 'oauth_signup', 'in_app_reacceptance')),
  constraint legal_acceptances_terms_version_not_blank check (btrim(terms_version) <> ''),
  constraint legal_acceptances_privacy_version_not_blank check (btrim(privacy_version) <> ''),
  -- One record per user per document pair: a retried signup or a
  -- double-submitted form updates nothing and inserts nothing.
  constraint legal_acceptances_user_version_unique
    unique (user_id, terms_version, privacy_version)
);

create index if not exists legal_acceptances_user_accepted_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

-- Users may read their own consent history and nothing else. There is no
-- insert, update, or delete policy at all, so history is append-only from the
-- application's service role and a user cannot rewrite what they agreed to.
drop policy if exists user_select on public.legal_acceptances;
create policy user_select on public.legal_acceptances
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.legal_acceptances from anon, authenticated;
grant select on table public.legal_acceptances to authenticated;
grant select, insert, update, delete on table public.legal_acceptances to service_role;

drop trigger if exists set_legal_acceptances_updated_at on public.legal_acceptances;
create trigger set_legal_acceptances_updated_at
before update on public.legal_acceptances
for each row execute function public.set_updated_at();

create or replace function public.record_legal_acceptance(
  p_user_id uuid,
  p_terms_version text,
  p_privacy_version text,
  p_source text
)
returns public.legal_acceptances
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.legal_acceptances;
begin
  if p_user_id is null then
    raise exception 'user_id_required' using errcode = '22023';
  end if;

  insert into public.legal_acceptances (user_id, terms_version, privacy_version, source)
  values (p_user_id, p_terms_version, p_privacy_version, p_source)
  on conflict (user_id, terms_version, privacy_version) do update
    -- Touch the row so the retry is a no-op that still returns the record,
    -- keeping the original accepted_at as the moment consent was first given.
    set updated_at = clock_timestamp()
  returning * into result;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- One-time auth action challenges
-- ---------------------------------------------------------------------------

create table if not exists public.auth_action_challenges (
  nonce uuid primary key,
  -- No foreign key on purpose: an account_deletion challenge is consumed in
  -- the same flow that deletes the Auth user, and a cascade racing that
  -- deletion must not be able to make the consume step fail.
  user_id uuid not null,
  purpose text not null,
  session_id text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  constraint auth_action_challenges_purpose_check
    check (purpose in ('password_reset', 'account_deletion', 'add_password', 'sensitive_change')),
  constraint auth_action_challenges_expiry_check check (expires_at > issued_at)
);

create index if not exists auth_action_challenges_expiry_idx
  on public.auth_action_challenges (expires_at);

alter table public.auth_action_challenges enable row level security;

-- No policies whatsoever: RLS with an empty policy set denies every row to
-- anon and authenticated. Only service_role, which bypasses RLS, may touch it.
revoke all on table public.auth_action_challenges from anon, authenticated;
grant select, insert, update, delete on table public.auth_action_challenges to service_role;

create or replace function public.issue_auth_action_challenge(
  p_nonce uuid,
  p_user_id uuid,
  p_purpose text,
  p_session_id text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_nonce is null or p_user_id is null or p_expires_at is null then
    raise exception 'invalid_auth_action_challenge' using errcode = '22023';
  end if;

  insert into public.auth_action_challenges (nonce, user_id, purpose, session_id, expires_at)
  values (p_nonce, p_user_id, p_purpose, p_session_id, p_expires_at);
end;
$$;

-- Marks a challenge used and reports whether *this* call was the one that did
-- it. The `consumed_at is null` predicate inside a single UPDATE is what makes
-- two concurrent replays resolve to exactly one winner: the loser matches zero
-- rows and gets false, with no read-then-write window in between.
create or replace function public.consume_auth_action_challenge(
  p_nonce uuid,
  p_user_id uuid,
  p_purpose text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  consumed_count integer;
begin
  update public.auth_action_challenges
  set consumed_at = clock_timestamp()
  where nonce = p_nonce
    and user_id = p_user_id
    and purpose = p_purpose
    and consumed_at is null
    and expires_at > clock_timestamp();

  get diagnostics consumed_count = row_count;
  return consumed_count = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pre-authentication rate limiting
-- ---------------------------------------------------------------------------

create table if not exists public.auth_rate_limits (
  action text not null,
  -- HMAC-SHA-256 of "<scope>:<value>" under AUTH_RATE_LIMIT_HMAC_SECRET.
  -- Reading this table tells an operator that some address or address-holder
  -- was throttled, never which one.
  identifier_hash text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (action, identifier_hash, window_start),
  constraint auth_rate_limits_action_not_blank check (btrim(action) <> ''),
  constraint auth_rate_limits_identifier_hash_check check (identifier_hash ~ '^[0-9a-f]{64}$'),
  constraint auth_rate_limits_request_count_check check (request_count >= 0)
);

create index if not exists auth_rate_limits_window_idx on public.auth_rate_limits (window_start);

alter table public.auth_rate_limits enable row level security;

revoke all on table public.auth_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.auth_rate_limits to service_role;

-- Fixed-window counter. `insert ... on conflict do update` is a single atomic
-- statement, so N concurrent requests produce N increments with no lost
-- updates and no advisory locking.
--
-- Fixed windows also bound the damage an attacker can do to a third party:
-- flooding a victim's address delays them until the window rolls over, and
-- never produces a permanent lockout.
create or replace function public.consume_auth_rate_limit(
  p_action text,
  p_identifier_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_start timestamptz;
  window_end timestamptz;
  current_count integer;
begin
  if p_limit is null or p_limit < 1 or p_window_seconds is null
    or p_window_seconds not between 1 and 86400
  then
    raise exception 'invalid_rate_limit_parameters' using errcode = '22023';
  end if;

  window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  window_end := window_start + make_interval(secs => p_window_seconds);

  insert into public.auth_rate_limits (action, identifier_hash, window_start, request_count)
  values (p_action, p_identifier_hash, window_start, 1)
  on conflict (action, identifier_hash, window_start) do update
    set request_count = public.auth_rate_limits.request_count + 1,
        updated_at = clock_timestamp()
  returning request_count into current_count;

  return jsonb_build_object(
    'allowed', current_count <= p_limit,
    'reset_at', window_end,
    'retry_after_seconds',
      greatest(1, ceil(extract(epoch from window_end - clock_timestamp()))::integer)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Operational auth events
-- ---------------------------------------------------------------------------

create table if not exists public.auth_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  result text not null,
  -- Null for every pre-authentication flow. Resolving a user id from a
  -- submitted address would create both an enumeration oracle and a log of
  -- who attempted to sign in.
  user_id uuid references public.profiles (id) on delete cascade,
  provider text,
  -- One of *our* stable codes. Never a provider message.
  reason text,
  occurred_at timestamptz not null default now(),
  constraint auth_events_result_check
    check (result in ('success', 'failure', 'rejected', 'throttled')),
  constraint auth_events_provider_check check (provider is null or provider in ('email', 'google')),
  constraint auth_events_event_type_length check (char_length(event_type) between 1 and 64),
  constraint auth_events_reason_length check (reason is null or char_length(reason) <= 64)
);

create index if not exists auth_events_user_occurred_idx
  on public.auth_events (user_id, occurred_at desc);
create index if not exists auth_events_type_occurred_idx
  on public.auth_events (event_type, occurred_at desc);

alter table public.auth_events enable row level security;

drop policy if exists user_select on public.auth_events;
create policy user_select on public.auth_events
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.auth_events from anon, authenticated;
grant select on table public.auth_events to authenticated;
grant select, insert, update, delete on table public.auth_events to service_role;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

-- Operational auth data is short-lived by design: rate-limit buckets and spent
-- challenges have no value once their window has passed, and keeping them
-- would only accumulate a record of when accounts were active.
create or replace function public.prune_auth_operational_data(
  p_event_retention_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  challenges_deleted integer;
  buckets_deleted integer;
  events_deleted integer;
begin
  if p_event_retention_days is null or p_event_retention_days not between 1 and 3650 then
    raise exception 'invalid_retention_window' using errcode = '22023';
  end if;

  -- One hour past expiry, so a request still in flight cannot lose its row.
  delete from public.auth_action_challenges
  where expires_at < clock_timestamp() - interval '1 hour';
  get diagnostics challenges_deleted = row_count;

  delete from public.auth_rate_limits
  where window_start < clock_timestamp() - interval '1 day';
  get diagnostics buckets_deleted = row_count;

  delete from public.auth_events
  where occurred_at < clock_timestamp() - make_interval(days => p_event_retention_days);
  get diagnostics events_deleted = row_count;

  return jsonb_build_object(
    'auth_action_challenges_deleted', challenges_deleted,
    'auth_rate_limit_buckets_deleted', buckets_deleted,
    'auth_events_deleted', events_deleted
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges: service_role only for every function above.
-- ---------------------------------------------------------------------------

revoke all on function public.record_legal_acceptance(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_legal_acceptance(uuid, text, text, text) to service_role;

revoke all on function public.issue_auth_action_challenge(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.issue_auth_action_challenge(uuid, uuid, text, text, timestamptz) to service_role;

revoke all on function public.consume_auth_action_challenge(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.consume_auth_action_challenge(uuid, uuid, text) to service_role;

revoke all on function public.consume_auth_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, text, integer, integer) to service_role;

revoke all on function public.prune_auth_operational_data(integer) from public, anon, authenticated;
grant execute on function public.prune_auth_operational_data(integer) to service_role;
