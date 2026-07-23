# Wardrobe AI data model

The Supabase schema treats `profiles` as the ownership root for private application data. A profile ID is exactly its Supabase Auth user ID. Deleting the Auth user cascades through the profile and every user-owned product row. The only deliberate exception is `storage_deletion_queue`: cleanup tasks retain the former user UUID until a trusted worker has removed the underlying private bytes.

## Migration order

1. `202607210001_core_wardrobe_imports.sql` creates profiles, wardrobe records, image lineage, durable import jobs/candidates, and product research.
2. `202607210002_outfits_agents_operations.sql` creates outfits, planning, immutable wear history, feedback, chat, agent summaries, idempotency, and rate-limit support.
3. `202607210003_security_storage_account.sql` enables RLS, creates private buckets, grants the minimum client privileges, and adds account lifecycle helpers.
4. `202607210004_stylist_conversation_history.sql` adds bounded stylist conversation history.
5. `202607210005_fix_reserved_time_keyword.sql` fixes a reserved-keyword variable name in rate-limit/idempotency functions.
6. `202607210006_wardrobe_compilation.sql` creates the precomputed outfit-candidate library (`outfit_candidates`, `outfit_candidate_items`, `wardrobe_compilation_state`/`jobs`).
7. `202607210007_account_deletion_workflow.sql` adds the durable, resumable account-deletion request table and RPCs.
8. `202607210008_wardrobe_compilation_v2.sql` adds normalized `occasion_category`, atomic finalize/exposure/fallback RPCs, the manual-recompile RPC, and the service-role batch-claim RPC for a real background worker.
9. `202607220001_curator_and_previews.sql` adds the wardrobe-change-event log, the curator analysis cache, the modeled-preview job queue, curator/preview state columns on `outfit_candidates`, modeled-preview consent columns on `profiles`, and a style-archetype column on `style_profiles`.

Migrations are additive and use `if not exists`, replaceable functions, stable trigger names, and replaceable policies where practical. Every private table enables RLS in the migration that creates it; owner policies arrive in migration 003, so a partially applied schema remains deny-by-default. Apply the files with the Supabase CLI rather than pasting them out of order.

## Ownership graph

```text
auth.users
└── profiles
    ├── style_profiles
    ├── wardrobe_items
    │   ├── wardrobe_item_images
    │   ├── item_research_runs
    │   │   └── research_sources
    │   ├── outfit_items ── outfits
    │   └── wear_log_items ── wear_logs
    ├── import_jobs
    │   └── import_job_candidates ── optional saved wardrobe_item
    ├── outfit_plans ── optional outfit
    ├── outfit_feedback ── outfit
    ├── outfit_candidates
    │   ├── outfit_candidate_items
    │   └── outfit_preview_jobs ── composite FK (candidate_id, user_id)
    ├── outfit_analysis_cache
    ├── conversations
    │   └── messages
    ├── agent_runs
    │   └── generated_outfit_saves ── outfits
    ├── api_idempotency_keys
    ├── feature_usage_counters
    └── rate_limit_events

wardrobe_change_events ── user_id FK'd to profiles, but item_id deliberately
                           not FK'd to wardrobe_items (mirrors
                           storage_deletion_queue: a 'deleted' event must
                           survive the item's hard delete)
storage_deletion_queue ── retained user UUID, no profile FK
feature_limits ── global database-owned quota configuration, no client access
```

Every user-owned table has `user_id`. Composite foreign keys such as `(item_id, user_id)` and `(outfit_id, user_id)` prevent a service-role bug from linking records belonging to different users. Nullable relationships use ownership-validation triggers for the same reason. Storage deletion tasks intentionally omit the profile foreign key so cleanup survives account deletion.

## Core records

### Profiles

`profiles` stores non-sensitive account preferences needed by the app shell, location/weather context, timezone, and onboarding completion. `style_profiles` contains optional sizes, style choices, temperature comfort, activities, and user-controlled modesty preferences.

`handle_new_auth_user()` creates a profile after an `auth.users` insert. The first migration also backfills profiles for Auth users that already exist.

### Wardrobe items and images

`wardrobe_items` contains the complete blueprint metadata, personal state, wear cache, purchase data, AI confidence, and confirmation audit fields. Items are normally soft-deleted with `deleted_at`; `status` represents archive/donation/sale/loss state.

AI output is deliberately separate from user confirmation:

- `ai_metadata` is the latest structured AI proposal.
- `field_confidence` records per-field confidence.
- `user_confirmed_fields` and `user_confirmed_at` record explicit review.
- Research proposals live in `item_research_runs` until accepted.

Manual creation and ordinary authenticated edits automatically append changed metadata fields to the confirmation audit. The research-accept RPC uses a transaction-local internal flag so an accepted AI proposal is not falsely recorded as direct user entry; it still skips fields the user previously confirmed.

`wardrobe_item_images` stores only object metadata and private Storage paths. `parent_image_id` preserves original → crop → cutout → thumbnail/modeled lineage. The same original outfit photo may be referenced by each detected item, while a partial unique index permits only one primary image per item. Storage cleanup uses reference checks and deletes shared bytes only after the final image row is gone.

### Import jobs and candidates

One uploaded photo creates one `import_jobs` row. Every detected garment becomes an ordered `import_job_candidates` row. This avoids the legacy design's duplicated original image and makes refresh/retry behavior durable.

Job states:

```text
queued → analyzing → review_crop → extracting → review_metadata
                                            └→ researching
                                              → complete
any active state → failed | cancelled
```

Candidate states:

```text
detected → review_crop → extracting → review_cutout → review_metadata
                                                    └→ researching
                                                      → approved
any review/processing state → rejected | failed
```

Worker lease fields (`locked_at`, `locked_until`, `next_attempt_at`) support retries without assuming one long-lived Next.js process. State-transition triggers release leases as soon as a job reaches review, terminal, or retryable-failure state, so a user's next action does not wait for a stale lease. The API should use an idempotency key when creating a job.

Create an import queue record only through `enqueue_import_job(p_original_image_bucket text, p_original_image_path text, p_idempotency_key text, p_request_hash text, p_input_metadata jsonb) returns jsonb`. The RPC verifies authentication, the caller-owned private path, the completed Storage object, the request hash, and the database-owned daily quota in one transaction. A same-key/same-hash replay returns the original job without consuming quota; a same-key/different-hash request returns HTTP 409. Its flat JSON result contains every `import_jobs` column plus `import_job_candidates` and `already_enqueued`.

A trusted worker can atomically lease one job with `claim_import_job(lease_seconds)` or a bounded batch with `claim_import_jobs(limit, lease_seconds)`. Both use `FOR UPDATE SKIP LOCKED` so several workers cannot claim the same job. Failed work is retryable up to a bounded attempt budget. Research workers use the matching `claim_research_job` / `claim_research_jobs` RPCs with their own smaller retry budget.

Authenticated interactive process routes use `claim_owned_import_job(p_job_id uuid, p_lease_seconds integer default 300) returns setof import_jobs` and `claim_owned_research_run(p_run_id uuid, p_lease_seconds integer default 300) returns setof item_research_runs`. Each atomically claims only an owned, due, claimable row with no active lease and increments the same 10-attempt import or 5-attempt research budget as the service worker. A successful claim returns one row. Missing, foreign-owned, not-yet-due, non-claimable, actively leased, or exhausted work returns an empty set; an expired exhausted row is first normalized to `failed` with `retry_exhausted`. Invalid lease arguments use `22023`, and unauthenticated invocation uses `42501`.

Once every candidate is either ready for metadata confirmation, already approved, or rejected, call `confirm_import_job(job_id)` as the authenticated user. It locks the job and every candidate, creates items and image-lineage rows, links each candidate to its saved item, and completes the database work in one transaction. Retrying returns the same item IDs without incrementing or duplicating anything. The server confirmation route then idempotently copies approved derivatives to stable item-prefixed paths; immutable job sources remain available if that media-finalization step must be retried.

### Research

`item_research_runs` durably stores `input_clues`, status, confidence, summary, proposed changes, and evidence without overwriting confirmed item data. `research_sources` records normalized source URLs and the fields each source supports. A run may be `verified`, `likely`, `uncertain`, or `not_found`; failed research never blocks item creation.

Create a run only through `enqueue_research_run(p_item_id uuid, p_input_clues jsonb) returns jsonb`. The RPC verifies an owned, non-deleted item and at least one usable brand/label/logo/SKU/barcode/visible-text/user clue before atomically consuming the database-owned daily quota. It returns the flat `item_research_runs` row as JSON.

Accept proposals through `accept_research_run(p_run_id, p_fields)`. The RPC locks the run/item, rejects unknown fields, applies only the selected proposal fields, and skips every field listed in `wardrobe_items.user_confirmed_fields`. It never changes that confirmation list. `reject_research_run(p_run_id)` records a rejection without touching the item; an accepted run cannot be auto-rolled back.

Authenticated sessions have `SELECT` only on `import_jobs`, `import_job_candidates`, `item_research_runs`, and `research_sources`. Enqueue/confirm/accept/reject RPCs and service-role workers are the only mutation paths, which prevents clients from resetting statuses or retry counters.

### Outfits, plans, and wear history

`outfits` and `outfit_items` save exact owned item IDs. Composite ownership constraints make cross-user outfit composition impossible, while a role-validation trigger and per-outfit role uniqueness keep composition coherent even for trusted-worker writes.

`save_generated_outfit(p_name, p_occasion, p_weather_context, p_explanation, p_confidence, p_items)` atomically verifies that every supplied ID is an owned, active, available item, rejects duplicate items/roles, enforces one dress or one top plus one bottom, and writes the AI outfit plus roles. `p_items` is an array of `{ "item_id": "uuid", "role": "top|bottom|dress|layer|shoes|accessory" }`; `itemId` and `id` are accepted aliases. The RPC returns the new outfit UUID.

`save_recorded_generated_outfit(p_generation_id)` requires an owned, completed Wardrobe Orchestrator run and reads the validated outfit directly from that server-authored run. It serializes on the generation and records the generation-to-outfit mapping in `generated_outfit_saves`, so retries return the original AI outfit instead of creating a duplicate, accepting client-edited output, or relabeling it as user-created.

`save_generated_plan(p_date, p_occasion, p_weather_context, p_name, p_explanation, p_confidence, p_items)` performs the same verification and atomically creates both the outfit and its planned-date row. It returns `{ outfit_id, plan_id }`.

`save_generated_week(p_plans)` validates one to seven unique dated plan payloads and saves the entire requested week in one transaction. If any day fails ownership, availability, role, or shape validation, no day from that batch is committed.

`swap_outfit_item(p_outfit_id, p_remove_item_id, p_replacement_item_id)` serializes changes to the selected outfit, verifies ownership and availability, enforces the same resolved role as the removed item, and preserves sort order in one transaction.

`create_user_outfit(p_name, p_occasion, p_season_tags, p_weather_context, p_explanation, p_confidence, p_favorite, p_items)` atomically validates and saves a one-to-five-item user-built outfit. It requires exactly one dress or exactly one top plus one bottom, allows one of each optional role, and returns the outfit JSON with its `outfit_items` array.

`wear_logs` is append-only to authenticated clients. `wear_log_items` snapshots the pieces worn, so historical reporting survives later outfit edits and item deletion; a deleted item's nullable ID is cleared while its safe snapshot remains. Use RPCs instead of direct inserts:

- `mark_outfit_worn(...)`
- `mark_wardrobe_item_worn(...)`

Both RPCs lock relevant rows, hash and scope client idempotency keys to the item/outfit resource, append history, and update `wardrobe_items.wear_count`/`last_worn_at` in the same transaction. Marking a planned outfit worn also updates the plan.

### Precomputed outfit-candidate library

`wardrobe_compilation_state` (one row per user) tracks the currently published `compiled_wardrobe_version`, `candidate_count`, `last_compiled_at`, and a `dirty_since`/`pending_change_count` pair a trigger on `wardrobe_items` maintains automatically. `wardrobe_compilation_jobs` is the durable, leased queue: at most one `queued`/`running` job per user (`wardrobe_compilation_jobs_user_active_unique`), retried with backoff up to a bounded attempt budget before landing in `failed`.

- `request_wardrobe_recompilation()` is the authenticated manual-recompile entry point: debounced against an already-active job, rate-limited via `consume_rate_limit`, and returns `{status: 'queued'|'already_running'|'up_to_date', job_id}`.
- `claim_next_own_wardrobe_compilation_job(lease_seconds)` lets an authenticated interactive route process its own queued job; `claim_wardrobe_compilation_jobs(limit, lease_seconds)` is the service-role batch claim a scheduler-driven worker uses instead (mirrors `claim_import_jobs`).
- `finalize_wardrobe_compilation(...)` is the only writer of the published-version pointer: it verifies the job's lease and the new version's row count, flips `wardrobe_compilation_state` atomically, archives the prior version, and compare-and-swaps `pending_change_count` to decide whether to clear `dirty_since` or queue a follow-up job.

`outfit_candidates` (versioned by `compiled_wardrobe_version`, one active version served at a time) and `outfit_candidate_items` store the generated combinations; `occasion_category` is a normalized category (see `resolveOccasionContext` in `src/lib/recommendation`) distinct from the free-text `occasion_tags`, and `weather_tags` records which temperature bands/rain-safety the outfit's own garments cover. `generated_by` is `compilation` for the precompiled library or `fallback_llm` for outfits the stylist had to compose live; `record_fallback_outfit_candidate(...)` and `increment_outfit_candidate_exposure(...)` are the only mutation paths, both atomic RPCs (never a read-modify-write or a multi-call insert that could leave a candidate with zero items).

### Outfit curator and modeled previews

`wardrobe_change_events` is an append-only log populated by three triggers (on `wardrobe_items`, `wardrobe_item_images`, and `style_profiles`) that record `created`/`metadata_changed`/`cutout_changed`/`availability_changed`/`deleted`/`preference_changed` rows with a point-in-time `item_version` marker. `compileWardrobeForUser` reads every unprocessed row for a user at the start of a compile to determine which items actually changed, marks them `processed_at` only after the compile finalizes successfully (so a crash mid-run naturally re-derives the same affected set next time), and uses that set to build a bounded curator shortlist instead of treating every compile as "everything changed."

The curator agent (`src/lib/ai/agents/outfit-curator-agent.ts`) reviews at most `WARDROBE_CURATOR_MAX_CANDIDATES` (default 40) candidates per call and runs at most `WARDROBE_CURATOR_MAX_CALLS_PER_COMPILATION` (default 2) times per compile, regardless of batch size: a "new/changed" shortlist (candidates touching this run's changed items) and, if budget remains, a "catch-up" shortlist of the oldest still-`curator_status='not_reviewed'` candidates. Each candidate is checked against `outfit_analysis_cache` (keyed by `(user_id, analysis_hash)`, where `analysis_hash` is a sha256 of sorted item IDs + each item's `updated_at` + the user's preference version + the style-knowledge package version + the curator model + prompt version) before spending a model call. `outfit_candidates.curator_status` is `not_reviewed | selected | rejected`; rejected candidates are never deleted (they remain a fallback/audit trail) but are excluded from stylist retrieval. A missing `OPENAI_CURATOR_MODEL`, a model error, or an exhausted `outfit_curator_calls` daily quota all leave affected rows `not_reviewed` without failing the compile — the deterministic `generated_by='compilation'` library is always the fully usable fallback, and the next compile's catch-up shortlist retries automatically.

Because `writeCandidates()` upserts on `(user_id, combination_key)` instead of always inserting, an unaffected candidate's curator verdict and cached preview survive an unrelated recompile untouched.

The modeled-preview pipeline is a separate claim-queue, `outfit_preview_jobs`, mirroring `wardrobe_compilation_jobs`'s claim/lease/backoff shape (`claim_outfit_preview_jobs`, `finalize_outfit_preview_job`, `fail_outfit_preview_job`). `enqueue_outfit_preview_job(...)` computes its own freshness hash from the candidate's current items + latest cutout timestamps, dedupes via a partial unique index (`outfit_preview_jobs_candidate_active_unique`), and soft-caps per-user queued jobs (returns `null` rather than erroring). It is called from four priority paths — new items just compiled, a saved outfit, tomorrow's planned outfit, and a frequently-suggested-but-preview-less candidate — plus the client-facing `request_outfit_preview(p_candidate_id)` wrapper, which additionally enforces `profiles.modeled_preview_consent` and a rate limit. `profiles.modeled_preview_consent` has a database-level co-constraint requiring `identity_reference_path` to already be set, so consent can never be enabled without a private reference photo on file. The preview worker (`src/jobs/generate-outfit-previews.ts`) never runs on the request path; it downloads the identity reference and each member item's cutout, calls the (already-existing) `generateModeledPreview()` image helper, and stores the result under `wardrobe-generated/{userId}/{candidateId}/...`, denormalizing `preview_status`/`preview_bucket`/`preview_storage_path` back onto the `outfit_candidates` row for the retriever to read with zero extra joins.

### Chat and observability

`messages` contains only user-visible content and structured UI results. Never store hidden chain-of-thought. `agent_runs` contains safe summaries, tool names/results summaries, model name, latency, usage, and error code; it must not contain API keys, original private images, or raw sensitive prompts. Authenticated users may read only their own agent runs; inserts and all later mutations are server/service-role operations so usage and audit records remain trustworthy.

## Operational controls

`api_idempotency_keys` supports claim, replay, completion, failure, stale-lock recovery, and request-hash mismatch detection through these RPCs:

- `claim_api_idempotency_key(...)`
- `complete_api_idempotency_key(...)`
- `fail_api_idempotency_key(...)`

`rate_limit_events` implements a rolling per-user feature bucket. Call `consume_rate_limit(bucket, limit, window, cost)` before expensive AI operations. An advisory transaction lock prevents concurrent requests from overspending a bucket.

`feature_usage_counters` enforces longer daily or monthly feature budgets on fixed UTC boundaries, so changing a style/weather timezone cannot mint another quota. `check_and_increment_usage(feature, limit)` atomically consumes one daily unit; `check_and_increment_usage_window(feature, limit, period, increment)` supports `day` and `month` counters. Import and research callers cannot choose their own limits: `feature_limits` owns the `image_import`, `item_research`, `outfit_curator_calls`, and `outfit_preview_generation` daily budgets and is inaccessible to authenticated clients. `service_check_and_increment_usage_window(...)` is the service-role-callable twin used by the compilation and preview workers, which run with no `auth.uid()` session.

When an enqueue budget is exhausted, PostgREST returns HTTP 429 with SQLSTATE/code `PT429`, message `daily_import_limit_reached` or `daily_research_limit_reached`, and a JSON-string `details` value containing `limit`, `used`, `remaining`, and `reset_at`. Because the counter and queue insert are in one transaction, a failed insert does not spend quota and concurrent requests cannot exceed it.

Other enqueue errors are stable machine-readable messages: `idempotency_key_payload_mismatch` (`PT409`), `import_image_not_found` or `wardrobe_item_not_found` (`PT404`), and `insufficient_research_clues` (`PT422`). Invalid argument shapes use SQLSTATE `22023`; missing server configuration uses `55000`; unauthenticated invocation uses `42501`.

Schedule `prune_wardrobe_operational_data()` with a trusted service role to remove expired idempotency rows and rate events older than 32 days; it also enqueues storage cleanup for previews on candidates about to be archived-pruned, and purges expired `outfit_analysis_cache` rows, old processed `wardrobe_change_events`, and old terminal `outfit_preview_jobs`.

Hard-deleting image, import-job, or import-candidate rows enqueues unreferenced object paths in `storage_deletion_queue`; replacing an image row's path performs the same old-path reference check. Candidate assets promoted to `wardrobe_item_images` are retained. A service-role worker leases tasks with `claim_storage_deletion_tasks(limit, lease_seconds)`, removes each object through the Storage API, and marks the queue row complete. Soft-deleting a wardrobe item intentionally retains its images until the product's retention behavior requests hard deletion.

## Account export and deletion

- `export_my_account_data()` returns the authenticated user's relational data plus a private Storage object manifest as JSON. File bytes are not embedded.
- `account_deletion_manifest()` returns row counts and every owned Storage object.
- `list_my_storage_objects()` returns the same paths as rows for batch removal.

Deletion is a durable, resumable two-step workflow tracked in `account_deletion_requests` (see `202607210007_account_deletion_workflow.sql`), not one synchronous request:

1. The route re-verifies the password (`supabase.auth.signInWithPassword`) before doing anything destructive.
2. `start_account_deletion()` durably records the request and enqueues every owned Storage object into the existing `storage_deletion_queue` (idempotent: retrying re-enqueues the same objects rather than duplicating work), then `mark_account_deletion_auth_pending()` advances the row to `deleting_auth_user`.
3. The route deletes the Auth user through the Admin API; the foreign-key cascade removes all relational data. Storage bytes are removed asynchronously afterward by the existing `claim_storage_deletion_tasks` worker, the same one that drains wardrobe-image/import cleanup.
4. The route marks the request `complete`.

`account_deletion_requests` intentionally has no foreign key to `profiles` (like `storage_deletion_queue`), so the audit row survives the Auth-user cascade. A crash between steps 2 and 3 leaves a `deleting_auth_user` row that a retried `DELETE /api/account` call resumes instead of losing track of.

`delete_my_relational_data(user_id_as_text)` exists as a narrowly confirmed fallback, but does not remove Storage bytes or the Auth user and should not be the normal account-deletion path.

## Legacy JSON migration

The old `data/library.json` records map as follows:

| Legacy field                         | New destination                                   |
| ------------------------------------ | ------------------------------------------------- |
| `id`                                 | `wardrobe_items.legacy_id`                        |
| `name`                               | `wardrobe_items.name`                             |
| `part`                               | mapped category plus `legacy_part`                |
| `color`, `secondaryColor`            | primary/secondary hex                             |
| `tags`                               | classify into richer metadata; retain raw payload |
| `image`, `thumbnail`, `modeledImage` | upload to private Storage and create image rows   |
| `importJobId`                        | `legacy_import_job_id`                            |
| complete source object               | `legacy_payload`                                  |

The one-time importer must be given an explicit destination user ID. It should upload files first, insert item/image rows in a transaction, and use `(user_id, legacy_id)` to make reruns idempotent.
