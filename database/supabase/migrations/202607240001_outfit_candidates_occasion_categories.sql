-- Wardrobe AI: outfit_candidates.occasion_categories -- a candidate can fit
-- more than one occasion bucket during compilation (see
-- generate-outfit-candidates/populate-candidates.ts), but the existing
-- occasion_category column is single-valued and combination_key is deduped
-- globally, so previously only the first bucket to produce a given
-- combination kept its occasion signal; every later bucket's identical
-- combination silently lost its fit. occasion_categories is additive (the
-- single-valued occasion_category column, its check constraint, and its
-- index are untouched -- they remain the curator's single-category signal,
-- see outfit_curator_agent) and lets retrieval query overlap instead of
-- equality.

set search_path = public, extensions;

alter table public.outfit_candidates
  add column if not exists occasion_categories text[] not null default '{}';

alter table public.outfit_candidates
  drop constraint if exists outfit_candidates_occasion_categories_check;
alter table public.outfit_candidates
  add constraint outfit_candidates_occasion_categories_check check (
    occasion_categories <@ array[
      'casual', 'work', 'business', 'interview', 'dinner', 'date', 'wedding',
      'formal_event', 'party', 'concert', 'travel', 'outdoor', 'exercise', 'errands'
    ]::text[]
  );

create index if not exists outfit_candidates_occasion_categories_idx
  on public.outfit_candidates using gin (occasion_categories);

-- Backfill: existing rows only ever had a single category recorded: seed the
-- array from it so pre-existing rows remain queryable via the new overlap
-- filter until the next compilation naturally repopulates them with the full
-- set of buckets they fit.
update public.outfit_candidates
set occasion_categories = array[occasion_category]
where occasion_category is not null
  and occasion_categories = '{}';
