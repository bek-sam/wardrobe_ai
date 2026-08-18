# Outfit Studio and interactive AI try-on

The Outfit Studio (`/studio`) turns a request into three complete looks built
only from owned, available garments, shows each as an interactive flat lay
made from real cut-outs, and — on explicit user action — renders an
identity-preserving, full-body **visualization** of that exact outfit.

> AI Try-On Preview — style visualization, not size or fit prediction.

That label is not decoration. It is rendered under every generated image and
burned into a footer strip on every download. Nothing in this feature predicts
physical fit, and nothing infers anything about the user's body.

## Architecture

### The core decision: visualizations belong to a snapshot, not a candidate

A visualization is pinned to an **immutable ordered outfit snapshot**, never to
an `outfit_candidates` row. A generated candidate, a saved outfit, a plan, and
a throwaway studio composition all normalize into the same snapshot, so one
pipeline serves every source, and the source can change later without
rewriting what was actually rendered.

`backend/src/lib/visualization-pipeline/` performs that normalization and
resolves each garment's current cut-out/content hash into snapshot rows.

### Request flow

```
POST /api/outfits/variants
  → orchestrator retrieval (deterministic: ownership, availability, weather,
    role, foundation, occasion) → up to 3 candidates on three different axes
  → deterministic diversity filter (foundation difference or ≤50% item overlap)
  → ONE stylist call explaining all three looks together
  → { variants: [safe | fresh | statement], contextSummary, shortfallReason }

POST /api/outfit-visualizations          (explicit "Try it on")
  → resolve source under the caller's own id
  → build immutable snapshot + per-cutout content hashes
  → compute freshness hash
  → request_outfit_visualization() RPC:
      ownership re-verification, dedupe, rate limit, queue cap, paid quota
  → durable outfit_visualization_jobs row

continuous Worker (`worker/src/jobs/generate-outfit-visualizations/`)
  → validating_inputs → generating → qa_review → localizing → ready
```

The long paid image call never runs inside an ordinary request. Backend enqueues
and returns status; continuously running Worker replicas claim the job from the
database. There is no inline-processing or scheduler-triggered HTTP fallback.

### Freshness and deduplication

`computeVisualizationSourceHash` (`src/lib/visualization/freshness.ts`) hashes:
ordered roles, exact ordered item IDs, **each cut-out's content hash**, the
identity reference's content hash, the prompt version, the provider capability
version, the configured model key, output size, output quality, and the QA and
localization schema versions.

Content hashes, not timestamps: a cut-out re-uploaded byte-for-byte identically
must not force a second paid generation, and a cut-out whose bytes changed
without its row being touched must. `wardrobe_item_images.content_sha256` is
populated lazily the first time an image is used for a visualization.

A partial unique index on `(user_id, source_hash)` over live rows is what makes
two simultaneous "Try it on" clicks collapse into one paid job.

### Every snapshot is validated server-side

The creating RPC re-derives all of this itself, independently of whatever the
route resolved:

- every item is owned, active, and available;
- the **declared role matches the item's actual role**, so a client cannot send
  its shoes labelled `top` and have the prompt render them as one;
- one garment per role, and a real foundation — exactly one dress, or exactly
  one top with one bottom.

That last rule matters most for `composition`, which arrives straight from the
client: without it a user could pay to render a recognizable full-body image of
themselves wearing a single garment.

### Enqueue outcomes are discriminated

`queue_full`, `quota_exhausted`, `conflict`, `needs_identity`, and
`needs_consent` are each distinct from `already_fresh`. Collapsing them was the
bug this replaces: it told users an image existed when none had been made.

### Quality gate

No generated image reaches `ready` without passing `evaluateQaGate`. A
structured vision assessment proposes; the deterministic gate decides.

- **Terminal**: identity mismatch, more than one person, broken anatomy.
- **Correctable**: a missing garment, an unfaithful _foundation_ garment, an
  invented garment, cropped framing.
- Accessories use looser fidelity thresholds but can never be invented.

At most **one** content-corrective regeneration is spent per request, built
from the specific structured failures. A second rejection is stored as a
terminal failure with a safe summary; the rejected image is never served.
Transient transport failures are a separate concern with their own bounded
retry budget.

### Hotspots

Localization runs after QA accepts the image and returns one normalized region
per garment. Regions that are missing, below `HOTSPOT_MIN_CONFIDENCE`, or an
implausible size for their role degrade to deterministic body zones labelled
`source: "fallback"`. A model region is never marked `user_corrected`.

**The garment chips are the accessible route and the real fallback.** They are
plain buttons, work with Tab/Enter alone, and are unaffected by localization
quality — the feature stays fully usable when every hotspot is approximate.

`resolveHotspotHit` sorts by `zIndex`, prefers a materially smaller region, and
shows a "Which layer?" chooser when two comparable layers genuinely overlap.

### Where garment facts come from

Every displayed garment fact is read from the owned `wardrobe_items` row. The
localization model only says _where_ a garment is; it never becomes the source
of a product fact, and nothing is inferred from generated pixels.

## Provider abstraction

`OutfitVisualizationProvider` has four methods: `generate`, `assess`,
`localize`, `assessIdentity`. Two implementations:

- **OpenAI adapter** — production.
- **Fake adapter** — deterministic, network-free, renders a real decodable
  portrait PNG and typed QA/localization results. Used by the E2E suite. It is
  only ever returned when `OUTFIT_VISUALIZATION_PROVIDER=fake` is set
  explicitly; it is **never** a silent fallback for missing configuration.

No test requires an OpenAI key, and CI makes no paid call.

### Model capability configuration

Model IDs stay in AI Orchestration environment variables. What that service
carries is a **capability profile** keyed by capability, not by model name:

| `OPENAI_IMAGE_CAPABILITY_PROFILE` | Meaning                                                                                                 |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `auto_fidelity` (default)         | The model applies high input fidelity automatically and rejects an explicit `input_fidelity` parameter. |
| `explicit_high_fidelity`          | The model requires `input_fidelity` to be sent.                                                         |

Only parameters the configured profile supports are sent, and output is always
portrait (`1024x1536`) — full-body try-on is never rendered landscape.

**Before changing the profile or the image model in a deployment:**

1. Run a non-production capability smoke test against the candidate model.
2. Confirm it accepts the portrait size and the profile's parameter set.
3. Then change `OPENAI_IMAGE_MODEL` / `OPENAI_IMAGE_CAPABILITY_PROFILE` only in
   AI Orchestration and bump the provider-neutral visualization policy version
   used in freshness/audit metadata.

The capability version is part of the freshness hash, so changing it correctly
invalidates every existing visualization rather than serving an image produced
under different behaviour.

## Privacy and security

- Buckets stay private. Only `{bucket, path}` is persisted; signed URLs are
  short-lived, generated per request after an ownership check, and never
  stored.
- The identity photo is validated on **decoded bytes**, normalized to sRGB PNG,
  and re-encoded through sharp — which strips EXIF and GPS. The raw upload is
  queued for deletion immediately; only the normalized copy is referenced.
- The persisted reference path is fully server-constructed. The client-supplied
  upload path is ownership-checked, used once to read bytes, and discarded.
- Consent is versioned (`TRYON_CONSENT_VERSION`), requires an explicit checked
  box, and never itself enqueues a generation.
- Replacing the photo deactivates the old reference, marks every ready
  visualization stale, and queues the old bytes for deletion. Revoking consent
  blocks future generations and can delete every generated asset.
- Provider errors are reduced to a bounded code and a safe summary before they
  reach a log line. The original error is dropped: SDK errors can echo the
  request body, which here means the prompt and the user's private photo.
- RLS is enabled in the creating migration for every new table, all children
  carry composite ownership foreign keys, and the MFA-assurance restrictive
  policy covers all five new tables.

## Quotas

The paid try-on budget is deliberately separate from the recommendation quota.

| Variable                              | Default | Purpose                            |
| ------------------------------------- | ------- | ---------------------------------- |
| `VISUALIZATION_DAILY_LIMIT`           | 10      | Paid generations per user per day. |
| `VISUALIZATION_MAX_QUEUED_PER_USER`   | 3       | Concurrent in-flight jobs.         |
| `VISUALIZATION_RATE_LIMIT_PER_MINUTE` | 3       | Request burst ceiling.             |

Quota is consumed on a newly accepted generation only — never on a status read
and never on a fresh reuse. A regeneration is a new paid call and consumes it
again.

## Migrations

- `202607300001_outfit_studio_visualizations.sql` — `profile_identity_references`,
  `outfit_visualizations`, `outfit_visualization_items`,
  `outfit_visualization_jobs`, `outfit_visualization_feedback`,
  `wardrobe_item_images.content_sha256`, RLS, MFA policies.
- `202607300002_outfit_visualization_rpcs.sql` — identity activation/revocation,
  create-or-reuse, claim/advance/finalize/fail, regenerate, feedback, delete,
  staleness triggers, export coverage, retention pruning.

Both are additive. The legacy `outfit_candidates` preview columns and
`outfit_preview_jobs` queue are untouched and keep working; deprecating them is
a later, separately approved migration.

## Rollout and rollback

**Rollout.** Apply both migrations and deploy AI Orchestration, Worker, Backend,
then Frontend. With `OPENAI_VISUALIZATION_QA_MODEL` unset in AI Orchestration,
try-on fails closed with a typed unavailable state while deterministic Studio
features keep working. Configure the model/profile and keep at least one Worker
replica running to enable generation.

**Rollback.** Unset `OPENAI_VISUALIZATION_QA_MODEL`. Try-on fails closed
immediately; nothing else in the studio is affected and no migration needs to
be reversed.

## Not built yet

Recorded here rather than left implied. None of these block the flow above.

- **Styling metadata v2.** The ~25 versioned garment attributes from the
  specification (`garment_length`, `sleeve_volume`, `neckline_or_collar`,
  `closure`, `bottom_rise`, `leg_shape`, `structure`, `fabric_weight`, `drape`,
  `stretch`, `sheen`, `sheerness`, `texture`, `layer_capacity`,
  `tuck_behavior`, footwear fields, per-field source/confidence) are not
  modelled, so there is no import proposal step, no grouped edit UI, and no
  backfill job for them. Scoring still runs on the existing item fields.
- **Outfit-level colour, proportion, and material/layering scoring.** The
  existing pairwise colour harmony and layering scores are unchanged. Only
  foundation _sampling_ was rewritten (see `build-foundations.ts`).
- **Studio entry points from a saved outfit or plan.** The pipeline, the RPC,
  and `resolveSourceSelections` all support `candidate`, `outfit`, and `plan`
  sources, and both are covered by tests — but the only UI that creates a
  visualization today is the studio's own `composition`.
- **Analytics events.** The repository has no analytics transport, so the
  event list in the specification is not emitted anywhere.
- **The 25-scenario offline fashion-quality eval set.** Not built.
- **Polygon hotspots.** The schema supports `version: 2` polygons; nothing
  produces them yet.

## Known limitations

- **Virtual try-on is a style visualization, not a prediction of physical
  fit.** Rendered drape, tailoring, and sizing may differ from real life.
- Identity, brand, and precise composition consistency remain imperfect at the
  provider level. The QA gate rejects the worst cases rather than hiding them.
- Hotspots are rectangles. Polygon masks are supported by the schema
  (`version: 2`) but not yet produced.
- Generation can take up to roughly two minutes.
