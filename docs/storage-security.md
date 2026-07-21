# Storage and database security

Wardrobe images are private user data. The database migrations create five non-public Supabase Storage buckets:

| Bucket               | Required path shape                               | Purpose                                                  |
| -------------------- | ------------------------------------------------- | -------------------------------------------------------- |
| `wardrobe-originals` | `{userId}/{jobId}/...`                            | original uploads and import lineage                      |
| `wardrobe-items`     | `{userId}/{itemId}/...`                           | manually uploaded item images and final item derivatives |
| `wardrobe-labels`    | `{userId}/{itemId}/...`                           | close label, logo, SKU, and barcode photos               |
| `wardrobe-generated` | `{userId}/{jobId}/...` or `{userId}/{itemId}/...` | AI cutouts and opt-in modeled/editorial generations      |
| `profile-references` | `{userId}/...`                                    | separately consented private identity references         |

Candidate crops remain under the import job's immutable `wardrobe-originals/{userId}/{jobId}/...` lineage. Extraction and modeled attempts use `wardrobe-generated/{userId}/{jobId}/...`. Database confirmation first creates item and lineage rows transactionally; the authenticated server route then copies approved crop/cutout/modeled assets to deterministic item-prefixed paths and conditionally updates only those image rows. Job-scoped source objects remain untouched for safe replay and are removed only by later job-retention cleanup.

Storage RLS requires the first path segment to equal `auth.uid()`. Read, insert, update, and delete policies all enforce the same boundary, so an object cannot be moved into another user's prefix.

## Server upload contract

RLS is not content validation. Before issuing a signed upload or accepting a completed upload, server code must:

1. Resolve the authenticated user and construct the path itself.
2. Enforce the route-specific byte limit.
3. Decode the file and validate its real format, dimensions, and pixel count.
4. Normalize orientation and color space.
5. Strip unnecessary EXIF and location metadata.
6. Reject decompression bombs and malformed images.
7. Store MIME type, dimensions, byte count, bucket, and path in the corresponding row.

Do not trust a client-provided `userId`, object path, extension, MIME type, `itemId`, or `jobId`.

## Signed URLs

- Keep buckets private; do not toggle `public` for convenience.
- Generate short-lived signed read URLs on authenticated server routes.
- Return signed URLs only after verifying the database row belongs to the caller.
- Do not persist signed URLs. Persist `{bucket_id, storage_path}` and sign when needed.
- Generated thumbnails should have separate object names and image rows.

## Relational RLS

Every user table has RLS enabled. Standard policies compare `auth.uid()` with `user_id`; `profiles` compares it with `id`. Junction tables also use composite foreign keys, preventing cross-user references even when a service-role worker bypasses RLS.

`agent_runs` is authenticated `SELECT`-only. Runtime code writes safe trace and usage summaries with the server-only service role after independently resolving the viewer, so clients cannot forge observability records.

The service-role key must remain server-only. Prefer a user-scoped Supabase client for ordinary routes, and reserve service role for background workers, Auth administration, cleanup, and other operations that cannot run under user RLS.

## Expensive operations

Import and product-research queues are created through `enqueue_import_job(...)` and `enqueue_research_run(...)`. These RPCs resolve `auth.uid()`, validate the owned source path or item, read fixed limits from the non-client-accessible `feature_limits` table, atomically consume a UTC-day counter, and insert the queued row. A rejected or failed insert rolls its quota change back. Exhaustion is a PostgREST HTTP 429 error (`PT429`) whose details include the reset timestamp.

Authenticated users can select their own import/research workflow rows but cannot insert, update, or delete them directly. Only enqueue/owned-claim/confirm/research-decision RPCs and service-role workers may mutate workflow state. Server routes using the service role must first authenticate the viewer and include explicit `user_id = viewer.id` predicates.

Before an interactive process route performs expensive work, it must obtain the row through `claim_owned_import_job(...)` or `claim_owned_research_run(...)`. An empty result means the row is missing, foreign-owned, not due, already leased, in a review/terminal state, or out of retries; the route must not process it. Only the route's later service-role updates may complete or release that successfully claimed lease.

Before other vision, image generation, or stylist calls:

1. Claim the request's idempotency key.
2. Consume the appropriate rate-limit bucket.
3. Create a durable job/agent-run record.
4. Use a bounded timeout and retry classification.
5. Complete or fail the idempotency record with a safe response summary.

Never put raw secrets, private image bytes, hidden model reasoning, or full third-party responses into `agent_runs`, errors, or idempotency response bodies.

## Deletion

Deleting rows from `storage.objects` with raw SQL is not the supported way to remove underlying files. Use the Storage API. Account deletion must remove all objects from `account_deletion_manifest()` before deleting the Auth user. The Auth deletion then cascades through `profiles` and all relational tables.

Hard-deleting image/import metadata automatically adds its object path to `storage_deletion_queue`. Queue rows intentionally survive profile/Auth deletion so no orphaned bytes become unreachable. Process that queue with a service-role worker; database triggers do not attempt to delete Storage bytes directly.

## Required isolation tests

Use two Auth users and verify at minimum:

- User A cannot select, update, or delete User B's profile, item, image metadata, job, candidate, outfit, plan, chat, or agent run.
- User A cannot connect their outfit/job/research rows to User B's records.
- User A cannot upload, list, sign, move, or delete an object under User B's prefix.
- Anonymous requests cannot access any wardrobe table or bucket.
- Mark-worn retries with the same idempotency key increment wear counts once.
- Concurrent rate-limit requests cannot exceed the configured budget.
- Auth user deletion removes all relational rows; the pre-deletion Storage manifest is empty after Storage cleanup.

## References

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
- [Supabase local CLI configuration](https://supabase.com/docs/guides/local-development/cli/config)
