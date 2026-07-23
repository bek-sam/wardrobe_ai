-- Adds the owned-job claim RPC for the modeled-preview pipeline, mirroring
-- claim_owned_import_job / claim_owned_research_run (202607210002). Without
-- it, POST /api/outfit-candidates/[candidateId]/preview only ever enqueues a
-- row into outfit_preview_jobs via request_outfit_preview(); nothing but the
-- service-role batch worker (claim_outfit_preview_jobs, reachable only via
-- the secret-gated POST /api/internal/outfit-previews/process) can ever pick
-- it up. With no scheduler configured in this repo, requested previews sat
-- queued forever in local/dev use. This lets an interactive, authenticated
-- route claim and process a single caller-owned job synchronously instead,
-- the same way imports and research runs already work without a scheduler.

set search_path = public, extensions;

create or replace function public.claim_owned_outfit_preview_job(
  p_candidate_id uuid,
  p_lease_seconds integer default 300
)
returns setof public.outfit_preview_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if p_candidate_id is null
    or p_lease_seconds is null
    or p_lease_seconds not between 30 and 1800
  then
    raise exception 'invalid_owned_outfit_preview_claim_parameters' using errcode = '22023';
  end if;

  update public.outfit_preview_jobs job
  set status = 'failed',
      error_code = 'retry_exhausted',
      error_message = 'Modeled preview generation exceeded its automatic retry budget.',
      locked_at = null,
      locked_until = null
  where job.candidate_id = p_candidate_id
    and job.user_id = current_user_id
    and job.status in ('queued', 'running', 'failed')
    and job.attempt_count >= 5
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
    and job.error_code is distinct from 'retry_exhausted';

  return query
  update public.outfit_preview_jobs job
  set status = 'running',
      locked_at = clock_timestamp(),
      locked_until = clock_timestamp() + make_interval(secs => p_lease_seconds),
      started_at = coalesce(job.started_at, clock_timestamp()),
      attempt_count = job.attempt_count + 1
  where job.candidate_id = p_candidate_id
    and job.user_id = current_user_id
    and job.status in ('queued', 'running', 'failed')
    and job.attempt_count < 5
    and coalesce(job.next_attempt_at, job.created_at) <= clock_timestamp()
    and (job.locked_until is null or job.locked_until <= clock_timestamp())
  returning job.*;
end;
$$;

revoke all on function public.claim_owned_outfit_preview_job(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_owned_outfit_preview_job(uuid, integer) to authenticated;
