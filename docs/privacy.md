# Privacy and user control

Wardrobe photos, profile preferences, location, plans, and wear history are private account data. This project is designed around user ownership, explicit review, and reversible AI proposals.

## Data boundaries

- Every user-owned relational row carries `user_id` or uses the Auth user ID as its primary key.
- PostgreSQL Row Level Security prevents one signed-in user from reading or mutating another user’s data.
- Images live in private Supabase Storage buckets; authenticated routes issue short-lived signed URLs.
- Object paths begin with the authenticated user ID and are constructed/validated server-side.
- Service-role and OpenAI secrets remain server-only.

## Image handling

Uploaded images are decoded and checked for supported content, dimensions, size, animation, and decompression risk. Normalization corrects orientation, converts color space, and removes unnecessary EXIF metadata before AI processing.

Originals, crops, cutouts, labels, and generated images retain explicit lineage. Users can reject candidates or generations. Modeled/identity-reference images require separate consent and are clearly labeled as generated, not an accurate fit simulation.

## AI behavior

- AI metadata remains a proposal until the user reviews it.
- Research claims retain sources and confidence.
- Visual similarity does not establish a brand or product identity.
- The stylist may select only exact IDs from the user’s available wardrobe candidate set.
- The application stores visible responses and safe execution summaries, never hidden model reasoning.
- Expensive routes are rate-limited and usage-accounted per user.

Private image or prompt content may be sent to configured AI providers when the user invokes an AI feature. Production privacy/terms copy must identify those processors, applicable retention settings, and the deployment operator’s contact details before public launch.

## Authentication and account access

Sign-in, two-factor authentication, sessions, and abuse controls are described in
[`authentication.md`](./authentication.md). Two points matter for privacy:

- A user with two-factor authentication enabled is protected **at the database**,
  not only in the interface. A session that has not satisfied the second factor
  cannot read or write any user-owned table or private Storage object, even if
  it bypasses this application entirely.
- Acceptance of the Terms and Privacy Policy is recorded against the exact
  document versions presented, in `legal_acceptances`. That record deliberately
  stores **no IP address and no user agent** — neither is needed to prove which
  text was accepted, and storing them would turn a consent record into a
  tracking record.

## Export and deletion

The Settings/API surface supports a JSON export of user-owned relational data.
Storage paths are included, not embedded image bytes. The export also carries
safe account metadata (user ID, confirmed email and its timestamp, account
creation time, provider names, and whether MFA is enabled) and the full legal
acceptance history. It never contains access or refresh tokens, provider
tokens, TOTP secrets, raw identity-provider payloads, or password hashes.

Account deletion proves identity by whatever method the account actually has —
current password, a Google round trip, or a one-time email link — plus the
second factor when one is enrolled. It then records a durable request, enqueues
every owned Storage object for background removal, and deletes the Auth user so
relational cascades can run.

**Deletion is only reported complete when it is complete.** That means all
three of: the Auth identity is deleted, the relational cascade has finished,
and every queued Storage object has been removed or verified absent. Until the
background worker has drained the queue the request sits in
`auth_deleted_storage_pending`, and the confirmation page says so plainly:
account access and records are gone immediately, private image files are
erased over the following minutes.

Objects that cannot be deleted after a bounded number of retries are moved to a
dead-letter state and the parent deletion is flagged for operator attention
rather than being quietly closed. Completed deletion records are pruned after
30 days; anything still needing repair is never pruned.

## Logging

Do not log raw uploads, signed URLs, precise private location beyond what is required, API keys, service credentials, hidden reasoning, or complete third-party responses. Error and agent traces should contain only stable IDs, safe classifications, timing, usage, and redacted summaries.
