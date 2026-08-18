-- ---------------------------------------------------------------------------
-- Fix: consume_auth_rate_limit() raised 42702 on every call
-- ---------------------------------------------------------------------------
--
-- The function declared a PL/pgSQL variable named `window_start`, which is
-- also a column of public.auth_rate_limits. In the `on conflict (action,
-- identifier_hash, window_start)` clause that name resolves against both, so
-- Postgres refused it as ambiguous and the function raised
-- `column reference "window_start" is ambiguous` before recording anything.
--
-- The limiter in src/lib/auth/rate-limit/consume.ts treats an error as a
-- denial, on the reasoning that an abuse control which disables itself under
-- load is not a control. That decision is right, and it is what kept this from
-- becoming a security hole -- but combined with a function that *always*
-- raised, it denied every attempt: login, signup, password recovery, magic
-- link, confirmation resend, MFA verification, password and email changes, and
-- account deletion were all permanently throttled.
--
-- Only the local variable names change here. Every parameter, the returned
-- JSON shape, the fixed-window arithmetic, and the privileges are identical to
-- 202607280001_auth_security_foundations.sql; the `v_` prefix simply cannot
-- collide with a column. The returned payload still carries no count and no
-- bucket identity, so a caller learns that it was throttled and when to retry,
-- never how much budget remains or whose bucket was charged.

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
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_current_count integer;
begin
  if p_limit is null or p_limit < 1 or p_window_seconds is null
    or p_window_seconds not between 1 and 86400
  then
    raise exception 'invalid_rate_limit_parameters' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  insert into public.auth_rate_limits (action, identifier_hash, window_start, request_count)
  values (p_action, p_identifier_hash, v_window_start, 1)
  on conflict (action, identifier_hash, window_start) do update
    set request_count = public.auth_rate_limits.request_count + 1,
        updated_at = clock_timestamp()
  returning request_count into v_current_count;

  return jsonb_build_object(
    'allowed', v_current_count <= p_limit,
    'reset_at', v_window_end,
    'retry_after_seconds',
      greatest(1, ceil(extract(epoch from v_window_end - clock_timestamp()))::integer)
  );
end;
$$;

-- `create or replace` preserves the existing grants, but they are restated so
-- this migration is correct if applied to a database where the function was
-- dropped rather than replaced. Reachable only by the service role: an
-- authenticated caller must never be able to charge or probe another
-- identifier's bucket.
revoke all on function public.consume_auth_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, text, integer, integer)
  to service_role;
