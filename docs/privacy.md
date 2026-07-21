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

## Export and deletion

The Settings/API surface supports a JSON export of user-owned relational data. Storage paths are included, not embedded image bytes.

Account deletion first builds a manifest, removes private Storage objects through the Storage API, and then deletes the Auth user so relational cascades can complete. Durable cleanup rows survive long enough to retry orphan removal. A production deployment should require recent re-authentication and show a final confirmation before deletion.

## Logging

Do not log raw uploads, signed URLs, precise private location beyond what is required, API keys, service credentials, hidden reasoning, or complete third-party responses. Error and agent traces should contain only stable IDs, safe classifications, timing, usage, and redacted summaries.
