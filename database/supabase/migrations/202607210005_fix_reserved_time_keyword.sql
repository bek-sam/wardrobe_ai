-- current_time is a reserved SQL keyword (CURRENT_TIME, time with time zone),
-- so a plpgsql variable with that name is ignored inside expressions and the
-- functions failed at first execution with type errors. Redefine both with v_now.

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window interval,
  p_cost integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  used_cost bigint;
  reset_time timestamptz;
  was_allowed boolean;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_bucket is null or p_bucket !~ '^[a-z0-9][a-z0-9_.:-]{0,79}$' then
    raise exception 'invalid rate-limit bucket' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 10000 or p_cost < 1 or p_cost > p_limit then
    raise exception 'invalid rate-limit cost or limit' using errcode = '22023';
  end if;
  if p_window < interval '1 second' or p_window > interval '31 days' then
    raise exception 'invalid rate-limit window' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_bucket, 0));

  select coalesce(sum(event.cost), 0), min(event.occurred_at) + p_window
    into used_cost, reset_time
  from public.rate_limit_events event
  where event.user_id = current_user_id
    and event.bucket = p_bucket
    and event.occurred_at > v_now - p_window;

  was_allowed := used_cost + p_cost <= p_limit;
  if was_allowed then
    insert into public.rate_limit_events (user_id, bucket, cost, occurred_at)
    values (current_user_id, p_bucket, p_cost, v_now);
    used_cost := used_cost + p_cost;
    reset_time := coalesce(reset_time, v_now + p_window);
  else
    reset_time := coalesce(reset_time, v_now + p_window);
  end if;

  return jsonb_build_object(
    'allowed', was_allowed,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - used_cost),
    'reset_at', reset_time
  );
end;
$$;

create or replace function public.claim_api_idempotency_key(
  p_scope text,
  p_idempotency_key text,
  p_request_hash text,
  p_ttl interval default interval '24 hours'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  key_record public.api_idempotency_keys%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_scope is null or btrim(p_scope) = '' or char_length(p_scope) > 100 then
    raise exception 'invalid idempotency scope' using errcode = '22023';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200 then
    raise exception 'invalid idempotency key' using errcode = '22023';
  end if;
  if p_request_hash is null or btrim(p_request_hash) = '' or char_length(p_request_hash) > 200 then
    raise exception 'invalid request hash' using errcode = '22023';
  end if;
  if p_ttl < interval '1 minute' or p_ttl > interval '7 days' then
    raise exception 'invalid idempotency ttl' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || p_scope || ':' || p_idempotency_key, 0));

  delete from public.api_idempotency_keys key
  where key.user_id = current_user_id
    and key.scope = p_scope
    and key.idempotency_key = p_idempotency_key
    and key.expires_at <= v_now;

  select key.* into key_record
  from public.api_idempotency_keys key
  where key.user_id = current_user_id
    and key.scope = p_scope
    and key.idempotency_key = p_idempotency_key
  for update;

  if not found then
    insert into public.api_idempotency_keys (
      user_id, scope, idempotency_key, request_hash, locked_until, expires_at
    ) values (
      current_user_id, p_scope, p_idempotency_key, p_request_hash,
      v_now + interval '5 minutes', v_now + p_ttl
    )
    returning * into key_record;

    return jsonb_build_object('state', 'claimed', 'id', key_record.id);
  end if;

  if key_record.request_hash <> p_request_hash then
    raise exception 'idempotency key was already used with a different request'
      using errcode = '22023';
  end if;

  if key_record.status = 'completed' then
    return jsonb_build_object(
      'state', 'completed',
      'id', key_record.id,
      'response_status', key_record.response_status,
      'response_body', key_record.response_body,
      'resource_type', key_record.resource_type,
      'resource_id', key_record.resource_id
    );
  end if;

  if key_record.status = 'processing' and key_record.locked_until > v_now then
    return jsonb_build_object('state', 'in_progress', 'id', key_record.id, 'locked_until', key_record.locked_until);
  end if;

  update public.api_idempotency_keys
  set
    status = 'processing',
    attempt_count = attempt_count + 1,
    locked_until = v_now + interval '5 minutes',
    expires_at = v_now + p_ttl,
    last_error = null
  where id = key_record.id;

  return jsonb_build_object('state', 'claimed', 'id', key_record.id);
end;
$$;
