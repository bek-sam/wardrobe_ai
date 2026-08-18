# Claude Code Master Prompt — Wardrobe Outfit Studio and Interactive AI Try-On

> Archived implementation brief. Paths below describe the former mixed root
> application. Current ownership is documented in [architecture.md](architecture.md):
> UI is root `src/`, public/server logic is `backend/`, durable pipelines are
> `worker/`, and prompts/provider code are `ai-orchestration/`.

Paste this entire document into Claude Code from the Wardrobe repository root.

---

## Your role

Act as a staff-level full-stack engineer, AI imaging engineer, product designer, privacy engineer, and expert fashion stylist. Implement the complete production version of Wardrobe’s outfit-generation and virtual try-on experience.

Do not stop after writing a plan. Inspect the current application, produce a short implementation checklist, and then implement the work phase by phase. Continue through safe, in-scope decisions without asking for approval. Pause only for a genuine blocker requiring a product choice, a credential, a paid production action, or destructive work outside this specification.

The result must feel like one coherent product, not a demo stitched onto the existing app.

## Product outcome

Build an **Outfit Studio** where a signed-in user can:

1. Ask for an outfit using occasion, weather, activity, location context, personal vibe, or natural language.
2. Receive three wearable looks made only from exact, active, available garments in that user’s wardrobe:
   - **Safe** — familiar, dependable, and easy to wear.
   - **Fresh** — a balanced variation that introduces a less-used combination.
   - **Statement** — expressive but still coherent, practical, and within the user’s preferences.
3. See every look immediately as an interactive flat lay made from the item cutouts already stored in the wardrobe.
4. Click **Try it on** and receive an identity-preserving, full-body AI visualization of that exact outfit inside the app.
5. Click or tap the shirt, pants, dress, outer layer, shoes, or accessory in the visualization and open a garment-detail popover or bottom sheet.
6. Read trustworthy clothing details sourced from the wardrobe database, not guessed from the generated pixels.
7. Open the exact garment’s wardrobe page, swap it, lock it, favorite it, or mark it worn.
8. Lock favorite pieces and remix only the remaining slots.
9. Save a look, wear it today, plan it for a date, privately download the try-on image, or give quick feedback.

The experience should be useful and calm first, then playful. Add delight through tasteful motion, concise stylist explanations, meaningful alternatives, and satisfying remix interactions. Do not turn the product into a slot machine or a social feed.

Every generated image must visibly carry the product label:

> AI Try-On Preview — style visualization, not size or fit prediction.

## Completion bar

This project is complete only when all of the following are true:

- A real authenticated user can complete the full flow from outfit request to interactive AI try-on.
- Generated recommendations use exact owned garment IDs and pass deterministic ownership, availability, role, foundation, weather, and dress-code validation.
- The three recommendation modes are genuinely different and visible in the UI.
- Flat lay works immediately without an AI-image call.
- Try-on generation is explicitly user-triggered, asynchronous, durable, resumable, deduplicated, and private.
- The try-on image preserves the user’s recognizable identity and depicts the selected garments closely enough to pass a structured quality gate.
- Clicking or keyboard-selecting a garment reliably opens its database-backed details and a working clothing-page link.
- Low-confidence garment localization still has a usable accessible fallback.
- Saved, manual, candidate, and newly generated outfits can all use the same visualization pipeline.
- Replacing the identity photo, changing an outfit piece, changing prompt/provider configuration, or changing a cutout correctly marks an existing visualization stale.
- Failed generation has actionable error and retry states.
- All private images remain in private buckets with ownership-checked, short-lived access.
- Unit, integration, E2E, accessibility, and fashion-quality evals cover the critical paths.
- No CI test makes a paid OpenAI call.
- `npm run check:quality` passes, and the local integration/E2E suites pass when their required services are available.

## Read before changing anything

1. Read `CLAUDE.md` completely and follow it.
2. Inspect the current branch and `git status`. The worktree may contain unrelated user changes. Preserve them. Never reset, overwrite, stage, or “clean up” work that is outside this feature.
3. Read:
   - `docs/architecture.md`
   - `docs/data-model.md`
   - `docs/privacy.md`
   - `docs/storage-security.md`
4. Inventory the current outfit, stylist, wardrobe, image, job, storage, account-deletion, and migration paths before editing.
5. Inspect the existing design tokens and responsive rules in `src/app/globals.css`; extend them instead of introducing an unrelated visual language.
6. Inspect all migrations in filename order and choose the next available migration timestamp at implementation time. Never edit a historical migration.
7. Re-run the current baseline checks before broad edits so pre-existing failures are separated from regressions.

Important repository constraints:

- This is Next.js App Router + strict TypeScript + Supabase + OpenAI.
- Production code must not use the legacy local JSON workflow.
- Model IDs come from environment configuration, never from hard-coded application source.
- AI-backed behavior fails closed when required configuration is missing; do not silently serve sample data.
- Expensive work belongs in durable database jobs and workers.
- Ordinary user routes resolve the authenticated viewer and use the least-privileged Supabase client possible.
- Service-role and worker secrets are server-only.
- Private images remain private.
- User-owned junctions use composite ownership foreign keys.
- Stateful and quota-sensitive mutations use transactional RPCs.
- File length is a review signal, not a limit. Split only at ownership, runtime,
  responsibility, reuse, or test seams; combine one-use helpers and barrels that
  add navigation without creating a meaningful boundary.
- Do not add hidden chain-of-thought logging. Store only safe, compact run summaries.
- Do not delete or weaken working behavior merely to make tests pass.

## Current implementation: preserve the strengths, repair the gaps

Confirm these findings against the current tree before implementing. Paths can move as the repository evolves, so search by symbol as well as filename.

### Existing strengths to preserve

- Outfit candidates already use deterministic ownership, availability, weather, role, and foundation validation.
- The styling path already combines compiled candidates with an AI curator and exact-ID validation.
- RLS, quotas, private storage, durable jobs, and transactional RPC patterns already exist.
- Image import already has validation, normalization, EXIF stripping, user review, and lineage concepts that should be reused.
- The app already has usable design tokens, typography, and responsive breakpoints.

### Known gaps to address

- Import metadata currently captures basics such as category, colors, pattern, silhouette, material, season, and occasion, but not enough garment-construction and layering detail for expert styling.
- Wardrobe editing exposes only a subset of styling-critical fields.
- The modeled-preview request currently has weak image-to-garment mapping, a generic prompt, a landscape-oriented output, unconditional parameter assumptions, and possible MIME mismatch.
- Preview freshness does not include every input that can change the rendered result.
- Enqueue results conflate “already fresh,” “queue full,” and conflicts.
- A generated image can become ready without a separate quality/fidelity gate.
- Failed preview UI lacks a complete retry path.
- Saved outfit cards do not consistently show their real garment cutouts or try-on visualization.
- Alternative recommendations are computed but not fully surfaced.
- Candidate foundations can be truncated before sufficient style-aware ranking.
- Color scoring is overly dependent on primary color and simple pairwise averaging.
- Background preview sweeps can do avoidable work for users who have not actively consented.
- The preview pipeline is too tightly coupled to outfit candidates and does not cleanly support manual or newly composed outfits.

Treat this list as an audit hypothesis. Verify it; do not blindly rewrite a path that has already been fixed.

### Verified starting code seams

Inspect these files first because the review found the relevant behavior there:

- `src/jobs/process-import/build-candidate-item.ts`
  - Current candidate metadata does not carry enough fit, warmth, formality, water resistance, garment length, closure, fabric behavior, or layering information into review.
- `src/features/wardrobe/components/wardrobe-manager.helpers.ts`
- `src/features/wardrobe/components/ItemEditFields.tsx`
  - Current edit payload/UI exposes only the basic wardrobe fields.
- `src/lib/ai/image-service/generate-modeled-preview.ts`
  - Current edit call uses a fixed landscape size, assumes one input-fidelity behavior, and should be checked for real input MIME handling.
- `src/lib/ai/prompts/outfit-preview.ts`
  - Current prompt needs explicit image-number/role mapping, construction fidelity, no-extra-garment rules, portrait/full-body framing, and a version.
- `database/supabase/migrations/202607220001_curator_and_previews.sql`
  - Current freshness/enqueue model needs identity/config/order/role/QA/localization inputs and discriminated request outcomes.
- `src/features/stylist/components/StylistRecommendationPreview.tsx`
  - Failed previews need actionable retry and correction states.
- `src/features/outfits/components/OutfitCard.tsx`
- `src/features/outfits/components/outfit-preview-mapping.ts`
  - Saved outfits should graduate from generic role artwork to real cutouts and the shared visualization status.
- `src/lib/ai/agents/orchestrator/handlers/outfit.ts`
  - Surface all validated alternatives rather than discarding Safe/Fresh/Statement choices.
- `src/lib/compilation/generate-outfit-candidates/build-foundations.ts`
  - Replace order-truncation with bounded, stratified, style-aware foundation sampling.
- `src/lib/recommendation/score-color-harmony.ts`
  - Move from primary-color pair averages toward outfit-level color/value/chroma/area evaluation.
- `src/jobs/generate-outfit-previews/sweep-frequent-candidates.ts`
  - Do not enqueue avoidable work for inactive consent; the user-triggered production path remains primary.

Search for callers and tests before changing any of these seams. Do not assume a single file is the complete behavior.

A prior review snapshot found unit tests, typecheck, and production build passing, but did not make a live paid try-on call and could not treat integration tests as run without local Supabase. Re-establish the baseline in the current worktree rather than relying on that snapshot.

---

# Product specification

## Problem

Today, recommending a technically valid set of garments is not enough. Users need to understand how a look comes together, see their exact pieces in context, experiment without losing a good item, and trust that a generated visualization represents their wardrobe and identity. A generic composite or an unverified image can feel magical for a moment but becomes harmful if it invents clothes, changes the person, hides failures, exposes private photos, or claims to predict physical fit.

The feature must close four gaps:

1. **Styling quality:** combinations should reflect color, proportion, fabric, construction, layering, context, and the user’s history.
2. **Visualization trust:** the selected garments and user identity must be traceable and quality-checked.
3. **Interaction:** the generated image must lead back to useful wardrobe actions rather than being a dead-end picture.
4. **Control and privacy:** generation must be opt-in, private, understandable, retryable, and deletable.

## Goals

- Make outfit generation feel like collaborating with a skilled personal stylist.
- Reduce decision fatigue while preserving user control.
- Help users rediscover underused wardrobe pieces without producing impractical looks.
- Make the exact garment behind every rendered region inspectable.
- Make visual generation trustworthy enough to support style decisions.
- Increase outfit saves, wears, wardrobe-item discovery, and confident experimentation.
- Reuse one secure visualization system across generated, saved, planned, and manual outfits.

## Non-goals

- Do not promise physical fit, tailoring accuracy, garment size prediction, or cloth simulation.
- Do not infer or label a body shape, body type, weight, attractiveness, gender identity, ethnicity, health condition, or age from an identity photo.
- Do not recommend purchases or invent marketplace products in this release.
- Do not introduce public sharing or a public image URL by default.
- Do not automatically generate a try-on merely because the user granted consent.
- Do not infer database facts such as brand, material, size, or care instructions from generated image pixels.
- Do not rebuild the legacy Vite/local-JSON workflow.
- Do not create an unrestricted “agent” with direct database or storage access.
- Do not treat an AI image as evidence that an outfit will physically fit.

## Primary user stories

### Outfit discovery

- As a user, I can describe where I am going and get complete looks suited to the occasion and conditions.
- As a user, I get conservative, balanced, and expressive options instead of three near-duplicates.
- As a user, I can understand the most useful reasons each outfit works.
- As a user, I can see warnings when a look is weather-sensitive, dress-code-sensitive, or based on uncertain metadata.

### Visual try-on

- As a user, I can deliberately request a private AI visualization of one selected look.
- As a user, I know what photo is used as my identity reference and can replace or delete it.
- As a user, I can see progress during a long-running generation and leave/reopen the page without losing it.
- As a user, I receive a clear explanation and recovery action when generation fails.

### Garment inspection

- As a user, I can tap the top, bottom, shoes, layer, dress, or accessory in the image.
- As a keyboard or screen-reader user, I can access the same garments without accurately clicking a picture.
- As a user, I can see the exact item’s details, why it was chosen, and a link to its wardrobe page.

### Outfit control

- As a user, I can lock one or more pieces and regenerate only the rest.
- As a user, I can swap a piece while preserving hard constraints.
- As a user, I can save, plan, wear, favorite, or privately download a look.
- As a user, I am told that the prior try-on is stale after changing a piece.

### Trust

- As a user, I can report “doesn’t look like me,” “wrong garment,” “bad anatomy,” “missing item,” or “other.”
- As a user, I can delete the identity reference and generated images from account settings.
- As a user, private photos are not used as public assets or placed in logs.

## Requirements by priority

### P0 — required for release

- Exact owned-item outfit generation with hard validation.
- Three recommendation variants: Safe, Fresh, Statement.
- Interactive cutout-based flat lay.
- Explicit identity reference and versioned consent.
- User-triggered durable try-on generation.
- Structured image quality gate before ready status.
- Database-backed garment detail UI.
- Click/tap hotspots plus keyboard-accessible garment selector.
- Direct route to the exact wardrobe item.
- Swap, lock, regenerate, save, and wear actions.
- Retryable, terminal, blocked, stale, superseded, and quota/error states.
- Private storage, RLS, signed access, deletion, account-lifecycle integration.
- Provider abstraction and fake provider.
- Unit, integration, E2E, and accessibility coverage without paid CI calls.

### P1 — strong release follow-up

- Plan-for-date action and calendar context.
- Private download with embedded AI-preview label.
- Structured feedback and safe analytics.
- Better wardrobe metadata suggestions and user confirmation.
- Quality evaluation dashboard or internal report.
- Saved/manual/planned outfit parity.
- Low-confidence localization correction UI where a user can select the right garment layer.
- Background storage cleanup and superseded-visualization retention policy.

### P2 — future, design for but do not block P0

- Polygon segmentation masks instead of rectangular hotspots.
- Pose choice using a small set of safe, tested presets.
- Side-by-side compare mode.
- Short-lived private share link with explicit opt-in.
- Garment-specific styling lessons.
- On-device or dedicated segmentation/localization service.
- More advanced fabric drape and layering evaluation.

## Product success metrics

Instrument privacy-safe events and build metrics around:

- Outfit request completion rate.
- Percentage of users viewing all three variants.
- Try-on request rate after outfit generation.
- Try-on technical completion rate and median/p95 latency.
- QA rejection and corrective-regeneration rates by failure reason.
- “Doesn’t look like me” and “wrong garment” feedback rates.
- Hotspot/detail open rate.
- Clothing-page navigation from a try-on detail.
- Swap, lock, remix, save, planned, and marked-worn rates.
- Underused-item inclusion and subsequent wear rate.
- Stale-preview regeneration rate.
- Retry success after transient failure.

Do not log raw photos, generated image bytes, free-form prompts, signed URLs, storage paths, or sensitive inferred traits in analytics.

---

# Experience and interaction design

## Information architecture

Create one reusable Outfit Studio experience. It should be reachable from:

- Outfit generation results.
- A saved outfit.
- A manual outfit composition.
- A planned outfit.
- A “wear today” context where appropriate.

Do not create separate try-on implementations for each source. Normalize every source into one authenticated, immutable outfit snapshot.

Suggested routes, adjusted to the app’s established route conventions:

- `/outfits/generate` or the existing stylist destination for request and results.
- `/outfits/[outfitId]` for a saved/manual outfit.
- `/outfits/[outfitId]/studio` only if a separate focused page is clearly better than an inline studio.
- `/wardrobe/[itemId]` for the exact clothing-detail destination. Reuse an existing detail route if one already exists; do not create duplicate item-detail concepts.

## End-to-end flow

### 1. Ask for a look

Provide a concise composer with:

- Natural-language request.
- Occasion chip or selector.
- Date/time.
- Indoor/outdoor or mixed.
- Weather/location when available.
- Activity level.
- Vibe chips such as polished, relaxed, minimal, playful, romantic, creative, sharp, or cozy.
- Optional “Surprise me” action that uses known preferences and the current context.

Do not force the user to fill every control. Natural language and sensible existing preferences should work. Clearly distinguish missing context from constraints that must be satisfied.

### 2. Show three useful variants

Show Safe, Fresh, and Statement as accessible tabs or segmented cards. Each variant includes:

- Real garment cutouts, name, role, and color.
- At most three concise “why this works” reasons.
- Any useful warning.
- Context fit, not a misleading universal percentage.
- Save, Try it on, Remix, and Wear Today actions.

Do not show raw internal scoring or model confidence as if it were a consumer-grade certainty score.

### 3. Explore in Outfit Studio

The center stage has two modes:

- **Flat Lay** — immediate, deterministic cutout composition; no generation wait.
- **AI Try-On** — generated full-body visualization after explicit user action.

Switching modes must not discard selection, locks, or actions.

### 4. Consent and identity setup

If no active identity reference exists:

- Explain why the photo is needed.
- Show concise photo guidance:
  - One person.
  - Full body, head to shoes.
  - Front or slight three-quarter angle.
  - Arms slightly away from torso.
  - Even natural light.
  - Minimal occlusion.
  - Neutral or close-fitting base clothing when comfortable.
  - No mirrors containing extra people.
- Show privacy and deletion information before upload.
- Use a checkbox or explicit button for consent; a passive link is not consent.
- Let the user review the normalized photo before it becomes active.

If validation finds a correctable issue, explain it with a retake suggestion. Fatal cases include no person, multiple prominent people, an unreadable/corrupt file, or an unsafe/moderated input. A borderline framing warning can be overridden explicitly.

Consent enables the feature. It does not itself enqueue a generation.

### 5. Generate and show progress

After **Try it on**:

- Immediately create/reuse a visualization row and return its status.
- Keep the selected flat lay visible.
- Show named progress steps:
  - Preparing your exact pieces.
  - Creating the try-on.
  - Checking garment and identity fidelity.
  - Mapping interactive garment details.
- Explain that high-quality image generation may take up to roughly two minutes.
- Allow the user to navigate away and reopen the result.
- Poll with backoff and pause or reduce polling when the tab is hidden.
- Do not display a fake exact percentage unless the backend has real progress.

### 6. Inspect garments in the image

Make the visualization interactive without requiring precision clicking.

Pointer behavior:

- Hovering a localized garment lightly outlines it and shows a role/name chip.
- Clicking opens its detail UI.
- If regions overlap, choose the smallest valid containing region with role `zIndex`; if ambiguity remains, show a tiny “Which layer?” chooser.
- On touch, one tap selects and opens the bottom sheet. Do not require hover.

Keyboard and screen-reader behavior:

- Render a visible or readily discoverable garment-chip list under/alongside the image.
- Each chip is a real button.
- Arrow navigation is optional; Tab/Shift+Tab and Enter/Space are required.
- Selecting a chip highlights the corresponding region.
- Announce the selected garment and detail-sheet state.
- The image itself has useful alt text but not a long list of all metadata.

### 7. Garment detail content

Desktop uses an anchored popover or persistent right detail panel. Mobile uses a full-width bottom sheet. Both show:

- Item cutout.
- User-confirmed name.
- Brand if present and confirmed.
- Category and outfit role.
- Primary and secondary colors.
- Pattern.
- Material/fabric if confirmed.
- Size if the user stored it.
- Fit and silhouette.
- Construction details such as neckline, sleeve, rise, leg shape, closure, length, or shoe type when present.
- Availability/laundry state.
- Wear count and last worn.
- Care notes if present.
- One or two concise reasons this item was selected for this look.
- Metadata-confidence warning where appropriate.

Actions:

- **View clothing** → exact authenticated item detail page.
- **Swap** → opens role-compatible owned items that still satisfy hard constraints.
- **Lock/Unlock**.
- **Favorite/Unfavorite** if supported.
- **Mark worn** through the canonical existing mutation.

Every fact comes from the owned wardrobe item/snapshot. A localization model only identifies the image region; it must never become the metadata source.

### 8. Lock, swap, and remix

- Every outfit slot has a lock control.
- Remix keeps locked item IDs exactly and regenerates only unlocked roles.
- Swap starts from compatible candidates and revalidates the complete look.
- If a swapped item makes another layer impossible, explain the conflict and offer valid alternatives instead of silently changing locked items.
- A piece change updates the flat lay immediately.
- A piece change marks the old AI try-on **stale** and presents **Update try-on**. Never pretend an old image represents a new combination.
- Preserve an undo opportunity for the most recent swap.

### 9. Feedback and recovery

Ready-state feedback options:

- Looks like me.
- Doesn’t look like me.
- Wrong garment.
- Missing garment.
- Bad anatomy or pose.
- Styling is not for me.
- Other, with optional short comment.

Failure states distinguish:

- Missing identity reference.
- Consent required or consent version outdated.
- Missing/invalid garment cutout.
- Outfit became unavailable.
- Quota reached and reset time.
- Provider temporarily unavailable.
- Moderation/input blocked with a safe explanation.
- QA rejection after the allowed correction.
- Superseded by a newer request.

Provide **Retry**, **Change photo**, **Change outfit**, or **Back to flat lay** only where each action can help.

### 10. Useful, restrained fun

Add delight through:

- A smooth cutout-to-try-on reveal.
- A short stylist note tailored to the selected variant.
- A satisfying lock state.
- A “Surprise me” option.
- Optional celebratory copy the first time an underused piece is saved or worn.
- Private side-by-side flat-lay/try-on comparison on larger screens if it fits P1.

Avoid:

- Confetti on every action.
- Random spinning or slot-machine animation.
- Streak pressure.
- Body-rating language.
- Fake urgency.
- Unbounded chatty explanations.

## Responsive handoff

Use existing `src/app/globals.css` tokens:

- Paper surfaces: `--paper`, `--paper-deep`, `--paper-soft`, `--paper-light`.
- Text: `--ink`, `--ink-soft`, `--muted`.
- Borders: `--line`, `--line-strong`.
- Accents: `--rust`, `--rust-dark`, `--sage`, `--gold`.
- Shadows: `--shadow-soft`, `--shadow-float`.
- Radii: `--radius-sm`, `--radius`, `--radius-lg`.
- Preserve Instrument Sans and the existing Georgia heading treatment.

Do not introduce a generic neon AI gradient. The try-on should feel editorial, warm, tactile, and consistent with the app.

### Desktop, 961px and wider

- Use a 12-column layout.
- Controls/variant rail: 3 columns.
- Main preview: 6 columns.
- Garment/style detail panel: 3 columns.
- If the available width is smaller, use 4/5/3 or collapse explanations before shrinking the image.
- Keep the full-body image large enough for inspection.
- Allow the detail panel to remain visible when a garment is selected.

### Tablet, 721–960px

- Preview becomes the primary full-width surface.
- Request/variant controls can live above or in a drawer.
- Garment details use a side drawer or wide bottom sheet.
- Preserve visible variant switching and primary actions.

### Mobile, 720px and below

- Image first.
- Full-width mode tabs.
- Horizontal, labeled Safe/Fresh/Statement selector.
- Sticky bottom action dock for Try it on / Update / Save.
- Full-width garment detail sheet with a safe-area inset.
- Garment chips scroll horizontally but remain keyboard accessible.
- No tiny icon-only primary actions.

### Compact mobile, 460px and below

- Tighten spacing using existing patterns.
- Keep touch targets at least 44×44 CSS pixels.
- Allow action labels to wrap or use a clearly labeled overflow menu for secondary actions.
- Do not reduce garment chip hit targets.

## Component architecture

Use these names if they fit current feature conventions; otherwise preserve the responsibilities and choose locally consistent names:

- `OutfitStudioShell`
- `OutfitRequestComposer`
- `RecommendationVariantTabs`
- `RecommendationVariantCard`
- `OutfitCanvas`
- `FlatLayStage`
- `TryOnStage`
- `TryOnConsentGate`
- `IdentityReferenceManager`
- `TryOnProgress`
- `TryOnStatusNotice`
- `InteractiveTryOnImage`
- `GarmentHotspotLayer`
- `GarmentSelectorChips`
- `GarmentDetailPopover`
- `GarmentDetailSheet`
- `OutfitWhyPanel`
- `PieceLockControls`
- `OutfitSwapPicker`
- `OutfitActionDock`
- `TryOnFeedback`

Split data hooks, state machines, coordinate transforms, and request clients out
of visual components when they form independent behavioral or runtime seams.
Keep one-use presentational fragments with their parent component.

## State and visual specifications

Every interactive component must define and test:

- Default.
- Hover where applicable.
- Keyboard focus-visible.
- Pressed/selected.
- Disabled with reason.
- Loading.
- Empty.
- Partial metadata.
- Offline/network retry.
- Stale.
- Failed retryable.
- Failed terminal.
- Ready.
- Superseded.

Use skeletons only when geometry is known. Use text status for a long-running generation. Never leave a blank image frame with a spinner and no explanation.

## Motion

- Use approximately 180–240ms for small transitions.
- Use opacity/transform and avoid expensive layout animation.
- Use one restrained reveal when the final image becomes ready.
- Highlight regions with a subtle outline/fill, not a pulsing effect.
- Honor `prefers-reduced-motion`; remove nonessential transitions and never require animation to understand state.

## Accessibility

- Meet WCAG 2.1 AA for the complete flow.
- Maintain visible focus.
- Use semantic buttons and dialog/sheet primitives.
- Trap focus inside modal sheets and restore it to the opening control.
- Give every icon-only action an accessible name.
- Keep 44×44 touch targets.
- Do not use color alone for state.
- Use `aria-live="polite"` for status transitions and assertive announcements only for actionable failures.
- Provide garment chips as an equivalent alternative to clicking image coordinates.
- Ensure the detail UI is not clipped at 200% zoom.
- Test keyboard-only desktop and screen-reader-friendly mobile DOM order.

---

# Fashion intelligence specification

## Expert styling principles

The engine must treat an outfit as a structured visual and practical system, not a bag of individually compatible garments.

Always evaluate:

1. **Context:** occasion, dress code, activity, indoor/outdoor, travel, time of day.
2. **Weather:** temperature range, feels-like temperature, precipitation, wind, humidity where meaningful, and location uncertainty.
3. **Foundation:** exactly one dress or exactly one top plus one bottom.
4. **Availability:** active, owned, not deleted, not laundry-blocked, and available for the requested date.
5. **Proportion:** garment lengths, waist emphasis, rise, volume distribution, visual weight, and intentional balance.
6. **Color:** hue relationships, value contrast, chroma, neutral anchors, placement, and visible area.
7. **Material:** weight, drape, texture, sheen, stretch, sheerness, seasonality, and formality.
8. **Layering:** sleeve bulk, armhole capacity, closures, necklines, hem relationships, and indoor removability.
9. **Footwear:** activity, weather, hem interaction, formality, visual weight, and comfort preference.
10. **Personal preference:** liked/disliked colors, styles, fits, coverage, repeated combinations, favorite pieces, and experimentation tolerance.
11. **Rotation:** underused pieces and recent wear, without sacrificing practicality.
12. **Metadata confidence:** uncertain facts should reduce confidence, not be silently treated as truth.

Do not infer a “correct silhouette” from the user’s body. Style from garment relationships and explicit preferences.

## Styling metadata v2

Extend the item model with versioned, user-reviewable styling attributes. Prefer a clear typed schema or well-validated `jsonb` plus indexed top-level fields where queries require them. Follow current data-model conventions.

Include only fields that are useful and explainable:

- `garment_length`: cropped, waist, hip, tunic, mini, knee, midi, maxi, unknown.
- `sleeve_length`: sleeveless, cap, short, elbow, three_quarter, long, unknown.
- `sleeve_volume`: fitted, regular, voluminous, unknown.
- `neckline_or_collar`: crew, v, scoop, square, turtleneck, mock, button_collar, lapel, hood, other, unknown.
- `closure`: pullover, button_front, zip_front, partial_zip, wrap, hook, lace, slip_on, open_front, other, unknown.
- `bottom_rise`: low, mid, high, unknown.
- `leg_shape`: skinny, slim, straight, tapered, bootcut, wide, flare, barrel, short, unknown.
- `skirt_shape`: pencil, straight, a_line, pleated, full, slip, wrap, other, unknown.
- `structure`: soft, semi_structured, structured, unknown.
- `fabric_weight`: light, medium, heavy, unknown.
- `drape`: fluid, balanced, rigid, unknown.
- `stretch`: none, low, medium, high, unknown.
- `sheen`: matte, subtle, shiny, unknown.
- `sheerness`: opaque, semi_sheer, sheer, unknown.
- `texture`: smooth, knit, ribbed, fuzzy, denim, leather_like, woven, technical, embellished, other, unknown.
- `layer_capacity`: base_only, light_layer, medium_layer, outer_layer, unknown.
- `tuck_behavior`: easy, partial_only, bulky, not_applicable, unknown.
- `shoe_style`, `toe_shape`, `heel_height`, and `weather_protection` for footwear.
- `warmth`, `water_resistance`, `formality`, and `activity_suitability`.
- Per-field source and confidence: user-confirmed, import proposal, research proposal, or unknown.

Requirements:

- Cataloging/import may propose values.
- The user reviews and confirms them before they become wardrobe truth.
- The wardrobe edit form exposes them in understandable grouped controls.
- Unknown is a first-class value.
- Existing items receive a safe backfill proposal job, not silently confirmed values.
- Styling can operate with partial metadata and state why confidence is lower.

## Deterministic hard constraints

Apply before and again after any model curator:

- Ownership.
- Active/not deleted.
- Availability and laundry state.
- Exact role compatibility.
- Valid foundation.
- Date conflicts.
- Weather hazards.
- Explicit dress code.
- Explicit user dislikes.
- Required footwear/activity constraints.
- Impossible layer ordering or bulk.
- Any locked item IDs.

The model must never override these constraints.

## Candidate generation and diversity

Fix early order-based truncation. Build and rank a broad but bounded foundation set using stratified sampling:

- Strong context matches.
- Favorite/familiar foundations.
- Underused but compatible foundations.
- Color families.
- Dress vs separates where allowed.
- Silhouette families.

Then score and cap. Do not take the first database-ordered N combinations.

Generate enough valid candidates to support three meaningfully different variants without relaxing hard constraints.

Suggested starting weights, centralized and configurable:

- Weather/practicality: `0.18`
- Occasion/formality: `0.17`
- Silhouette/proportion: `0.16`
- Color: `0.14`
- Material/layering: `0.13`
- Explicit user preferences: `0.12`
- Rotation/underuse: `0.06`
- Metadata confidence: `0.04`

These are initial product defaults, not immutable facts. Add evals that reveal when a weight change improves or harms results.

## Color evaluation

Replace primary-color-only pair averages with outfit-level evaluation:

- Primary and secondary colors.
- Approximate visible area by role.
- Light/dark value distribution.
- Chroma/saturation balance.
- Neutral anchor.
- Accent or statement budget.
- Warm/cool relationship.
- Pattern scale and pattern count.
- User color preferences.

Do not rigidly enforce “60/30/10.” It can be one useful heuristic, not a law.

Examples of desired reasoning:

- “The cream knit softens the contrast between the dark denim and black loafer.”
- “The rust scarf is the single high-chroma accent; the rest of the look stays quiet.”
- “Two large-scale patterns compete, so use the solid trouser instead.”

## Proportion and silhouette

Evaluate role-to-role relationships:

- Fitted/relaxed/oversized volume.
- Cropped/hip/tunic/long lengths.
- Rise and waist placement.
- Top-to-bottom volume distribution.
- Coat and inner hem relationships.
- Shoe visual weight relative to hem width.

Allow intentional oversized or volume-on-volume looks when they match the user’s preferences and the materials support them. Do not apply simplistic body-type rules.

## Material and layering

Evaluate:

- Fabric weight progression from base to outer layer.
- Sleeve bulk inside armholes.
- Closure compatibility.
- Neckline and collar collisions.
- Hem lengths.
- Sheerness and needed base layers.
- Texture competition.
- Formality and sheen.
- Indoor removability.

Examples:

- A bulky sweater should not be placed under a narrow fitted blazer unless metadata says the blazer has capacity.
- A long open cardigan can work over a fluid midi dress if hem relationships are intentional.
- A sheer top requires a confirmed or explicitly selected base layer.

## Footwear

Evaluate:

- Weather protection and traction.
- Walking/activity requirement.
- Formality.
- Hem length and width.
- Visual weight.
- User comfort preferences.

Do not complete a rainy commute look with delicate open footwear merely because the colors match.

## Safe, Fresh, and Statement selection

Select the final three from validated candidates:

### Safe

- High preference alignment.
- Familiar silhouette.
- Strong context confidence.
- No experimental warning.
- May include favorites but should avoid a recently repeated identical outfit where alternatives exist.

### Fresh

- One or two meaningful changes from the user’s common pattern.
- Prefer an underused compatible garment or a new color/material pairing.
- Preserve strong practicality.

### Statement

- Highest controlled contrast, expressive layer, texture, color, or accessory.
- Still passes weather, formality, activity, availability, and user boundaries.
- “Statement” must not mean random, costume-like, or uncomfortable.

Enforce diversity using exact item overlap, style dimensions, and foundation difference. Three labels on near-identical combinations are not acceptable.

## Model-assisted visual curation

After deterministic ranking, optionally give a bounded top-N contact sheet and compact metadata to the stylist/vision curator:

- Every cutout has an explicit image number and exact item ID mapping.
- The model chooses only from provided candidates.
- It returns exact IDs and structured, short reasoning.
- The server revalidates the final look.
- Invalid or unavailable output is rejected and never served.
- Do not send the whole wardrobe.

Surface all three alternatives already computed by the backend instead of returning only the first.

## Explanations

Return at most three user-facing reasons per look:

- One context/practical reason.
- One visual/style reason.
- One personal/rotation reason where useful.

Add a warning only when the user can act on it. Do not expose private internal chain-of-thought, raw scores, or verbose fashion jargon.

---

# Visualization system architecture

## Core design decision

Decouple visualizations from `outfit_candidates`. A visualization belongs to an immutable, authenticated **outfit snapshot**, regardless of whether it originated from:

- A generated candidate.
- A saved outfit.
- A manual composition.
- A planned outfit.
- A temporary studio composition.

The source can change later; the visualization’s exact ordered item snapshot cannot.

## Data model

Choose names that fit current schema conventions, but preserve these responsibilities.

### `profile_identity_references`

Suggested fields:

- `id uuid primary key`
- `user_id uuid not null`
- `bucket_id text not null`
- `storage_path text not null`
- `sha256 text not null`
- `normalized_mime text not null`
- `width integer not null`
- `height integer not null`
- `validation_status text not null`
- `validation_summary jsonb`
- `is_active boolean not null default false`
- `consent_version text`
- `consented_at timestamptz`
- `created_at`, `updated_at`, `deleted_at`

Rules:

- One active non-deleted reference per user.
- User owns/selects; service code confirms validated file details.
- Replacing a photo deactivates the prior reference and marks affected current visualizations stale.
- Deletion enqueues storage cleanup.
- Reconsent is required only when the legal/product consent version changes, not simply for every photo replacement. Photo replacement still requires an explicit confirmation.

### `outfit_visualizations`

Suggested fields:

- `id uuid primary key`
- `user_id uuid not null`
- `source_kind text not null`
- `source_id uuid`
- `source_hash text not null`
- `status text not null`
- `identity_reference_id uuid not null`
- `prompt_version text not null`
- `provider text not null`
- `model_key text not null`
- `capability_version text not null`
- `output_size text not null`
- `output_quality text not null`
- `bucket_id text`
- `storage_path text`
- `output_sha256 text`
- `qa_status text`
- `qa_summary jsonb`
- `localization_version text`
- `error_code text`
- `error_summary text`
- `attempt_count integer`
- `corrective_attempt_count integer`
- `request_id text`
- `created_at`, `updated_at`, `started_at`, `completed_at`, `stale_at`, `deleted_at`

`model_key` should record a safe configured identifier or capability key, not cause source code to hard-code a provider model.

### `outfit_visualization_items`

Suggested fields:

- `visualization_id uuid`
- `user_id uuid`
- `item_id uuid`
- `role text`
- `sort_order integer`
- `cutout_bucket_id text`
- `cutout_storage_path text`
- `cutout_sha256 text`
- `hotspot jsonb`
- composite primary/unique keys and composite ownership foreign keys

Snapshot garment details needed for an audit can be stored carefully, but the detail UI should read current owned item data while clearly handling archived/deleted status.

### `outfit_visualization_jobs`

Follow the existing durable job pattern:

- `id`
- `visualization_id`
- `user_id`
- `status`
- `attempt_count`
- `max_attempts`
- `next_attempt_at`
- `locked_at`
- `locked_by`
- `last_error_code`
- `last_error_summary`
- `request_id`
- timestamps

Claim with `FOR UPDATE SKIP LOCKED`, lease safely, recover abandoned leases, and distinguish transient retry from terminal failure.

### `outfit_visualization_feedback`

- `id`
- `visualization_id`
- `user_id`
- Enumerated reason.
- Optional bounded comment.
- Created timestamp.

Do not store raw image content in feedback.

## Migration strategy

- Add only forward migrations after the latest existing migration.
- Enable RLS in the same migration that creates each table.
- Add ownership-scoped indexes and composite foreign keys.
- Use deny-by-default policies.
- Make client mutation paths RPC-based where quotas, idempotency, ownership, or state transitions are involved.
- Preserve existing candidate-preview columns/tables initially.
- Backfill or dual-read behind a feature flag.
- Do not destructively drop the old path until the new pipeline is proven and a later cleanup migration is explicitly approved.
- Extend account deletion/export and storage cleanup for every new row and asset.

## Visualization status model

Expose an explicit application state machine:

```text
needs_identity
needs_consent
queued
validating_inputs
generating
qa_review
localizing
ready
stale
failed_retryable
failed_terminal
blocked
superseded
```

Database job statuses may be smaller, but the API and UI mapping must preserve these meanings.

Never map every enqueue `null` to `already_fresh`. Return a discriminated result such as:

```ts
type VisualizationRequestResult =
  | { outcome: "created"; visualizationId: string; status: "queued" }
  | { outcome: "reused"; visualizationId: string; status: VisualizationStatus }
  | { outcome: "already_fresh"; visualizationId: string; status: "ready" }
  | { outcome: "queue_full"; resetAt?: string }
  | { outcome: "quota_exhausted"; resetAt: string }
  | { outcome: "conflict"; reason: string }
  | { outcome: "needs_identity" }
  | { outcome: "needs_consent"; consentVersion: string };
```

## Freshness and deduplication

Create a canonical, stable hash over:

- Ordered roles.
- Exact ordered item IDs.
- Each current cutout content hash.
- Identity reference content hash.
- Prompt version.
- Provider capability version.
- Configured model key.
- Output size.
- Output quality.
- QA schema/version.
- Localization schema/version.

Do not depend only on timestamps if a content hash is available.

The same fresh source hash should reuse a ready or active visualization. Concurrent requests must not create duplicate active jobs. A newer snapshot supersedes an older in-flight request safely.

## Identity upload and validation

Reuse the secure upload/import pipeline:

1. Authenticated route allocates a user-scoped signed upload destination.
2. Browser uploads directly to `profile-references`.
3. Confirmation route resolves the user and constructs/validates the expected path.
4. Worker/server downloads bytes.
5. Validate file signature, not extension or claimed MIME.
6. Bound decoded dimensions and total pixels.
7. Normalize orientation and color space.
8. Strip EXIF, GPS, and unnecessary metadata.
9. Convert to the canonical supported format and record the real MIME.
10. Run basic identity-reference suitability validation.
11. Let the user review and explicitly activate the normalized result.

Fix any existing behavior that labels JPEG/WebP bytes as PNG. Never trust a user-provided storage path.

Suitability output should be structured:

```ts
type IdentityReferenceAssessment = {
  personCount: number;
  fullBody: "yes" | "partial" | "no";
  faceVisible: boolean;
  occlusion: "low" | "medium" | "high";
  lighting: "good" | "usable" | "poor";
  framing: "good" | "usable" | "poor";
  verdict: "pass" | "warn" | "fail";
  userMessage: string;
};
```

Never return body judgments or sensitive-trait inferences.

## API contracts

Adapt route names to current conventions, but keep contracts typed and ownership-safe.

### Create or reuse a visualization

`POST /api/outfit-visualizations`

Request:

```ts
{
  sourceKind: "candidate" | "outfit" | "plan" | "composition";
  sourceId?: string;
  compositionToken?: string;
}
```

The server:

- Resolves the authenticated viewer.
- Loads the source with ownership checks.
- Resolves exact active items server-side.
- Constructs the immutable snapshot.
- Verifies consent/reference/cutouts/availability.
- Consumes quota transactionally only when appropriate.
- Creates or reuses the visualization and durable job.

Response:

```ts
{
  outcome: "created" | "reused" | "already_fresh";
  visualizationId: string;
  status: VisualizationStatus;
  pollAfterMs: number;
}
```

Return typed error payloads for other outcomes.

Do not accept client-supplied `userId`, item metadata, bucket, path, or signed URL.

### Read visualization

`GET /api/outfit-visualizations/[visualizationId]`

Return:

- Current status.
- Safe progress label.
- Short-lived image URL only when ready/stale and owned.
- Snapshot roles and exact IDs.
- Current owned garment details.
- Hotspots.
- Stale reason.
- Retry/change-photo/change-outfit capabilities.
- AI-preview disclaimer.

Use `Cache-Control: private, no-store` for responses containing signed URLs.

### Regenerate

`POST /api/outfit-visualizations/[visualizationId]/regenerate`

- Resolve ownership.
- Construct a new immutable attempt/snapshot where needed.
- Do not mutate history so aggressively that debugging or feedback loses its target.
- Respect quota/idempotency.

### Feedback

`POST /api/outfit-visualizations/[visualizationId]/feedback`

- Strict enum and bounded comment.
- Ownership check.
- Rate limit.

### Private download

`GET /api/outfit-visualizations/[visualizationId]/download`

- Ownership check.
- Proxy or stream from private storage.
- `Content-Disposition: attachment`.
- Include the AI-preview label in the output asset or a generated footer.
- Never persist or return a permanent public URL.

### Outfit generation

Update the existing outfit endpoint to return:

```ts
{
  variants: [
    {
      mode: "safe" | "fresh" | "statement";
      candidateId?: string;
      compositionToken: string;
      items: OutfitItemView[];
      reasons: string[];
      warnings: string[];
      canVisualize: boolean;
    }
  ];
  contextSummary: string;
}
```

The exact schema should use current domain types and authenticated source IDs. A composition token must be server-verifiable, short-lived, and tamper-resistant or represented by a temporary owned database snapshot.

## Worker and polling

- Production relies on the existing secured internal-worker/scheduler pattern.
- Interactive user routes may process one owned queued job only as an explicitly feature-gated convenience; do not make a long paid image call the normal route-handler lifecycle.
- Suggested client polling: 1.5 seconds, then 3 seconds, then 5 seconds, capped near 5 seconds.
- Reduce/pause polling when the document is hidden and refresh immediately on visibility.
- Stop polling on terminal/ready/stale/superseded.
- An SSE path can be future work; do not introduce it unless it fits the current architecture cleanly.

---

# OpenAI image provider and quality pipeline

## Provider abstraction

Introduce an interface such as:

```ts
type GenerateOutfitVisualizationInput = {
  identity: NormalizedPrivateImage;
  garments: Array<{
    imageNumber: number;
    itemId: string;
    role: OutfitRole;
    name: string;
    confirmedDetails: ConfirmedGarmentDetails;
    cutout: NormalizedPrivateImage;
  }>;
  posePreset: PosePreset;
  output: { orientation: "portrait"; quality: "high" };
  promptVersion: string;
};

interface OutfitVisualizationProvider {
  generate(input: GenerateOutfitVisualizationInput): Promise<GeneratedImage>;
  assess(input: AssessVisualizationInput): Promise<VisualizationAssessment>;
}
```

Implement:

- OpenAI production adapter.
- Deterministic fake/test adapter.
- Capability-aware request builder.
- Safe error normalization.

No tests should require an OpenAI key.

## Current-model compatibility rule

Do not blindly hard-code or switch the production model.

At the time this specification was written, the official OpenAI image-generation guide presents `gpt-image-2` as the current image model and states that it uses high input fidelity automatically, so `input_fidelity` should be omitted. However, provider reference/OpenAPI surfaces can lag or list a different supported model set. Therefore:

1. Keep the image model environment-driven.
2. Add a capability configuration keyed by validated model family/capability, not scattered model-name conditionals.
3. Perform a non-production capability smoke test before changing deployment configuration.
4. Only send parameters supported by the configured model.
5. Do not unconditionally send `input_fidelity`.
6. Record the capability version in the visualization freshness hash.

Official references:

- OpenAI image generation guide: <https://developers.openai.com/api/docs/guides/image-generation>
- OpenAI image input-fidelity section: <https://developers.openai.com/api/docs/guides/image-generation#image-input-fidelity>
- OpenAI image-model limitations: <https://developers.openai.com/api/docs/guides/image-generation#limitations>
- OpenAI GPT-5.6 prompting guidance: <https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6>

## Input ordering and mapping

The prompt and payload must identify every image explicitly:

- Image 1: identity reference; preserve identity, facial features, hair, skin tone, and general appearance.
- Image 2: exact top, item ID/role in server context.
- Image 3: exact bottom.
- Image 4: exact outer layer.
- Image 5: exact shoes.
- Remaining images: exact accessories in order.

Use only the number of garment inputs the provider supports. If the provider limit is lower than the outfit, define a deterministic priority/merge strategy and expose a warning or block rather than silently omitting a required foundation item.

Do not include raw IDs in user-visible prompt text if unnecessary, but keep exact server-side mapping for QA.

## Generation prompt requirements

Create a versioned prompt builder, not a mutable inline string. It must:

- State that Image 1 is the identity reference and must not supply clothing.
- Map each following image to one exact garment role.
- Require a single person, full body, head through shoes, portrait framing.
- Preserve recognizable identity, face, hair, skin tone, and general physical appearance without beautification or body reshaping.
- Place the person in a natural neutral editorial pose that keeps garment regions visible.
- Use the exact supplied garments and no substitutes.
- Preserve:
  - Dominant and secondary colors.
  - Pattern placement.
  - Silhouette.
  - Garment length.
  - Neckline/collar.
  - Sleeve length and volume.
  - Rise and leg shape.
  - Closure and open/closed state.
  - Texture, sheen, and distinctive construction.
  - Visible logos or text only where accurately reproducible; do not invent text.
- Require logical layering order.
- Disallow extra jacket, bag, belt, scarf, jewelry, or shoes unless supplied.
- Use a simple warm-neutral editorial background with good garment separation.
- Avoid cropping feet or head.
- Avoid hands obscuring important garment features.
- State that this is style visualization, not fit simulation.

Keep the prompt precise. Do not ask the model for unsupported hidden reasoning.

## Output shape

Use a portrait-oriented size supported by the configured provider. Do not hard-code the current landscape `1536x1024` behavior for full-body try-on. Choose and validate a portrait configuration through the provider capability layer.

Decode returned content and validate:

- Real image format.
- Dimensions.
- Pixel count.
- Non-empty bytes.
- Expected orientation/aspect tolerance.
- Content hash.

Normalize only where necessary without degrading detail.

## Structured quality assessment

Never mark the first generated image ready without a separate assessment.

Use a structured vision assessment with a versioned schema:

```ts
type VisualizationAssessment = {
  identity: {
    recognizableMatch: "pass" | "uncertain" | "fail";
    faceVisible: boolean;
  };
  framing: {
    singlePerson: boolean;
    fullBodyVisible: boolean;
    headVisible: boolean;
    shoesVisible: boolean;
  };
  anatomy: {
    verdict: "pass" | "uncertain" | "fail";
    issues: string[];
  };
  garments: Array<{
    itemId: string;
    role: OutfitRole;
    present: boolean;
    colorFidelity: "pass" | "uncertain" | "fail";
    patternFidelity: "pass" | "uncertain" | "fail";
    silhouetteFidelity: "pass" | "uncertain" | "fail";
    constructionFidelity: "pass" | "uncertain" | "fail";
    closureFidelity: "pass" | "uncertain" | "fail";
    distinctiveDetailFidelity: "pass" | "uncertain" | "fail";
  }>;
  extraGarments: string[];
  verdict: "pass" | "correctable" | "fail";
  correctionInstructions: string[];
  safeSummary: string;
};
```

Validation after assessment:

- Required foundation items must be present.
- Identity cannot be a fail.
- Single-person and full-body checks must pass.
- No unrequested major garment can be present.
- Anatomy cannot fail.
- Each primary garment must meet minimum fidelity.
- Accessories can use slightly different thresholds but cannot be invented.

Allow at most one content-corrective regeneration per user request. Build a revised prompt from specific structured failures. Transient transport/provider retries are separate and use bounded exponential backoff. Do not send the exact same content request repeatedly and hope for a different result.

If correction still fails, store the safe failure summary and show a helpful recovery path. Never expose the rejected image as a normal ready result.

## Error handling

Normalize provider errors into:

- Configuration missing.
- Authentication/permission.
- Unsupported parameter/capability.
- Input validation.
- Moderation/input blocked.
- Rate limit/quota.
- Transient provider.
- Timeout.
- Invalid output.
- QA rejection.
- Unknown safe fallback.

Store request IDs when available, but never request bodies, raw images, signed URLs, or secrets.

OpenAI notes that image generation can take up to roughly two minutes and that identity, brand, recurring character, and precise composition consistency can remain imperfect. Design the queue, UI, quality gate, and user language around those limitations rather than hiding them.

---

# Interactive hotspot and detail system

## Hotspot schema

Start with normalized bounding rectangles and support future polygons:

```ts
type GarmentHotspot =
  | {
      version: 1;
      itemId: string;
      role: OutfitRole;
      shape: "rect";
      bounds: { x: number; y: number; width: number; height: number };
      confidence: number;
      source: "model" | "fallback" | "user_corrected";
      zIndex: number;
    }
  | {
      version: 2;
      itemId: string;
      role: OutfitRole;
      shape: "polygon";
      points: Array<{ x: number; y: number }>;
      confidence: number;
      source: "model" | "fallback" | "user_corrected";
      zIndex: number;
    };
```

All coordinates are normalized to `0..1` relative to the natural generated image.

## Localization

The same structured assessment can return boxes, or a separate bounded localization call can run after QA. Whichever path is more reliable:

- Return one region per visible garment.
- Return confidence.
- Keep exact item/role mapping.
- Validate every coordinate is finite and within `0..1`.
- Reject extremely small or implausibly large areas by role-aware thresholds.
- Allow overlapping layers.
- Never mark a generated model box as user-confirmed.

## Coordinate transformation

Implement and unit-test a pure utility that maps normalized natural-image coordinates to the displayed image:

- Account for intrinsic image width/height.
- Account for container width/height.
- Account for `object-fit: contain`.
- Account for horizontal/vertical letterboxing.
- Recalculate with `ResizeObserver`.
- Support device-pixel-ratio without mixing CSS and device pixels.
- Do not use viewport guesses.

## Hit resolution

When a pointer hits multiple regions:

1. Sort by explicit layer `zIndex`.
2. Prefer the smallest containing region when it is materially more specific.
3. If two plausible layers remain, show a small chooser with item cutouts/names.

Suggested visual layer priority can be role-aware but must not hide a selectable inner item:

- Accessories placed above outerwear.
- Outerwear above tops/dresses.
- Tops/dresses above bottoms where they overlap.
- Footwear isolated lower.

## Fallback

If localization is missing or below threshold:

- Keep the garment-chip list fully functional.
- Optionally show approximate, deterministic body zones for top, bottom, dress, outerwear, and shoes.
- Label approximate regions internally and avoid presenting them as precise segmentation.
- If dress and outerwear overlap heavily, rely on chips/chooser rather than a misleading precise box.

The feature is usable even when every image hotspot is unavailable.

## Detail-data boundary

The visualization response can include an owned, sanitized `GarmentDetailView`, but:

- It is built from the database.
- The server checks ownership.
- A missing/deleted item is represented safely.
- No storage path is exposed.
- Image URLs are short-lived and private.
- No localization or vision output becomes a product fact.

---

# Privacy, safety, security, and lifecycle

## Consent

- Use a versioned consent statement specific to AI try-on.
- Explain what is uploaded, what is generated, that third-party AI processing is involved where applicable, and how to delete it.
- Record consent version and timestamp.
- Require explicit user action.
- Revoking consent blocks new generations and can offer deletion of reference/generated assets.
- Consent does not make automatic background generation acceptable.

## Storage

- Use existing private `profile-references` and `wardrobe-generated` buckets if their policies and semantics fit.
- Paths remain `{userId}/...` and are server-constructed.
- Persist bucket/path, never a signed URL.
- Generate short-lived signed URLs only after ownership verification.
- Use the Storage API and the existing deletion queue for bytes.
- Do not make buckets public.

## RLS and ownership

- Enable RLS in each creating migration.
- Users can read only their own visualization rows/items/feedback/reference metadata.
- Direct client state transitions for expensive jobs should be denied.
- Service-role mutations must independently resolve/verify the user and use composite ownership constraints.
- Test cross-user denial for rows, RPCs, sources, item IDs, downloads, and storage.

## Quotas and abuse controls

- Separate recommendation quota from paid try-on quota.
- Consume quota transactionally on a newly accepted generation, not on status reads or a fresh reuse.
- Define when a failed provider attempt is refunded or not, and encode it consistently.
- Bound active jobs per user and globally.
- Return reset/capacity information without leaking other users.
- Rate-limit feedback, upload allocation, status polling, regeneration, and download.

## Retention and deletion

- Define retention for superseded, failed, and ready assets.
- Keep enough safe metadata for debugging without retaining unnecessary private images.
- Replacing identity reference queues the old bytes for deletion after any deliberate grace period.
- Deleting a visualization deletes its generated asset and hotspot/QA metadata according to policy.
- Account deletion must remove all new rows and enqueue all new storage paths.
- Account export must document whether generated images are included and provide them only to the owner.

## User language

Always describe the result as a visualization. Never say:

- “This fits you.”
- “This makes you look thinner/taller.”
- “This is correct for your body type.”
- “The model proves this size works.”

Acceptable:

- “See the outfit together.”
- “AI style preview.”
- “The rendered drape may differ from real life.”

---

# Analytics and observability

Add privacy-safe events following current analytics conventions:

- `outfit_request_submitted`
- `outfit_variants_returned`
- `outfit_variant_selected`
- `outfit_piece_locked`
- `outfit_piece_swapped`
- `outfit_remix_requested`
- `tryon_consent_viewed`
- `tryon_consent_accepted`
- `identity_reference_activated`
- `tryon_requested`
- `tryon_reused`
- `tryon_ready`
- `tryon_failed`
- `tryon_retry_requested`
- `tryon_stale`
- `tryon_garment_selected`
- `tryon_item_page_opened`
- `tryon_feedback_submitted`
- `outfit_saved`
- `outfit_marked_worn`
- `tryon_downloaded`

Allowed dimensions are bounded enums/booleans/timings such as source kind, variant mode, status, safe failure code, attempt count, and latency bucket.

Never include:

- Raw prompt text.
- Item names typed by the user if analytics are third-party.
- Image bytes.
- Signed URL or storage path.
- Model request body.
- Sensitive visual inference.

Operational telemetry should include:

- Queue depth and lease age.
- Generation duration.
- QA/localization duration.
- Error codes.
- Retry count.
- QA rejection reasons as bounded enums.
- Stale/reuse/deduplication counts.
- Storage cleanup failures.

---

# Testing and evaluation

## Unit tests

Add focused tests for:

- Exact identity/garment image ordering.
- Prompt mapping for 1, 2, 3, and layered outfits.
- Prompt version in freshness hash.
- Identity hash, cutout hash, item order, role, model capability, size, quality, QA version, and localization version each changing freshness.
- Stable hash for semantically identical ordered inputs.
- Model capability builder includes only supported parameters.
- MIME detection and canonical normalization.
- Provider error normalization.
- QA pass/correctable/fail gates.
- One corrective attempt maximum.
- Enqueue outcomes remain distinguishable.
- Lease and retry classification helpers.
- Hotspot schema validation.
- Normalized coordinate transformation.
- `object-fit: contain` letterboxing in wide and tall containers.
- Resize behavior.
- Overlap resolution and chooser fallback.
- Low-confidence hotspot fallback.
- Garment detail data is database-sourced.
- Stale state after swap.
- Lock invariants.
- Safe/Fresh/Statement diversity.
- Hard constraint enforcement before and after curation.
- Color value/chroma/role-area cases.
- Silhouette/proportion cases.
- Layer bulk/closure/neckline cases.
- Weather and footwear cases.
- Unknown metadata behavior.
- No body-type inference field or prompt language.

## Integration tests with local Supabase

Cover:

- Identity signed-upload allocation and confirmation.
- Path ownership and magic-byte validation.
- Consent required before generation.
- Cross-user reference denial.
- One active identity reference.
- Replacement invalidates current visualizations and enqueues cleanup.
- Visualization creation from candidate, saved outfit, manual outfit, and plan.
- Source ownership validation.
- Item ownership and availability revalidation.
- Fresh reuse and concurrent dedupe.
- Queue-full versus already-fresh versus conflict.
- Durable claim/lease/retry/recovery.
- Composite ownership foreign keys.
- Quota consumption.
- Ready signed-URL access by owner only.
- Private download owner-only.
- Feedback owner-only.
- Account deletion cascades and storage queue population.
- Stale invalidation from item/cutout/reference/config changes.

## E2E with fake provider

Create a deterministic fake-provider flow with representative fixture images:

1. Sign in.
2. Request an outfit.
3. See Safe/Fresh/Statement.
4. Select Fresh.
5. See exact cutout flat lay.
6. Open Try it on.
7. Complete identity consent/upload using a safe synthetic fixture.
8. Request generation.
9. Observe progress.
10. Receive fake ready visualization.
11. Click top hotspot.
12. See exact DB-backed shirt detail.
13. Open item page.
14. Return, lock shirt, swap pants.
15. See old try-on become stale.
16. Update try-on.
17. Save and mark worn.
18. Submit feedback.

Also test:

- Retryable failure then success.
- Terminal QA failure.
- Mobile bottom sheet.
- Keyboard-only garment selection.
- Reduced-motion mode.
- Refresh/reopen while queued.
- Deleted/unavailable item.
- Low-confidence localization fallback.

## Fashion-quality evaluation set

Build a versioned offline eval with at least 25 consented synthetic/internal wardrobe scenarios; commit metadata and synthetic assets only, never private real-user photos without explicit authorization.

Include:

- Hot humid day.
- Freezing layered commute.
- Rain and walking.
- Business formal.
- Smart casual.
- Date night.
- Wedding guest constraints.
- Creative workplace.
- Travel/airport.
- Errand/casual.
- Dress foundation.
- Separates foundation.
- Oversized intentional styling.
- Tonal neutral look.
- High-chroma accent.
- Pattern mixing success.
- Pattern mixing failure.
- Sheer top requiring base.
- Bulky sweater/fitted jacket conflict.
- Long coat/long dress.
- Wide trouser/light shoe imbalance.
- Underused item opportunity.
- Laundry/availability conflict.
- Sparse metadata.
- Strong explicit user dislike.

For each scenario, define:

- Hard expected constraints.
- Acceptable foundation families.
- Known bad combinations.
- Expected Safe/Fresh/Statement difference.
- Explanation quality checks.

## Image-quality evaluation

Use a separate, consented or synthetic golden set. Score:

- Identity recognizable.
- One person.
- Full body framed.
- Required top/dress and bottom present.
- Shoes present when supplied.
- Major color fidelity.
- Pattern fidelity.
- Silhouette and length fidelity.
- Closure/construction fidelity.
- No invented major garment.
- Anatomy acceptable.
- Hotspot-to-item correctness.

Do not make paid calls in CI. Run production-model evals manually or in a separately authorized evaluation environment and store aggregate results/safe IDs, not private input images.

## Performance and reliability targets

- Outfit recommendation result: target under 10 seconds for typical wardrobes, excluding first-time compilation.
- Flat lay: interactive as soon as outfit data and signed cutouts load.
- Try-on median: at or below 90 seconds in the target environment.
- Try-on p95: at or below 180 seconds, with the UI designed for longer provider latency.
- Technical success after bounded retry: at least 90% in the evaluation environment.
- Wrong-identity assessment must never be marked ready.
- Golden-set required foundation presence: 100% among accepted ready outputs.
- All supplied primary garment fidelity: at least 90% among accepted ready outputs.
- Hotspot correct item for top/bottom/shoes: at least 90%; chip fallback: 100% usable.
- No duplicate paid job for the same active freshness hash.
- All authenticated routes enforce ownership.

## Required commands

Run targeted tests throughout. Before declaring complete:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run legacy:build
```

Then, where local prerequisites are available:

```bash
npx supabase start --workdir database
npx supabase db reset --workdir database
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Do not claim integration or E2E success if they were not actually run. Do not use a production OpenAI key in CI or automated tests.

---

# Phased implementation plan

Implement in reviewable phases. Keep the app working after each phase.

## Phase 0 — baseline, feature boundary, and evaluation scaffolding

Deliver:

- Current-state audit against this prompt.
- Feature flag/config boundary for the new Outfit Studio/visualization pipeline.
- Provider interface and fake provider.
- Shared visualization types/statuses.
- Initial fashion and image-quality eval fixtures.
- Baseline unit results recorded in the implementation notes.

Exit criteria:

- No user-facing behavior regresses.
- Fake provider can produce a typed visualization result without network access.
- Configuration is server-safe and model IDs remain environment-driven.

## Phase 1 — styling metadata and outfit engine v2

Deliver:

- Versioned styling-attribute schema.
- Import/cataloging proposals for new fields.
- User-review/edit controls.
- Backfill proposal job for existing items.
- Improved foundation sampling.
- Outfit-level color, proportion, material, layering, footwear, preference, and rotation scoring.
- Safe/Fresh/Statement selection and API result.
- Concise reasons/warnings.

Exit criteria:

- All three variants pass hard validation and are meaningfully distinct.
- Unknown metadata remains safe.
- New metadata is not silently confirmed.
- Fashion eval passes agreed hard cases.

## Phase 2 — identity reference and database foundation

Deliver:

- Forward migration for references, visualizations, items, jobs, feedback, indexes, RLS, and RPCs.
- Identity signed upload/confirmation/normalization/review/activation.
- Versioned consent.
- Freshness hash.
- Explicit enqueue outcomes.
- Account export/deletion/storage cleanup integration.
- Feature quotas.

Exit criteria:

- Cross-user tests fail closed.
- Reference replacement and deletion work.
- Same snapshot deduplicates.
- Saved/manual/candidate/plan snapshots normalize into one model.

## Phase 3 — generation, QA, localization, and worker

Deliver:

- OpenAI adapter behind capability-aware provider interface.
- Versioned prompt builder with explicit image mapping.
- Portrait output selection.
- MIME/output validation.
- Durable worker stages.
- Structured QA gate.
- One corrective content generation.
- Structured hotspot localization and validation.
- Safe observability.

Exit criteria:

- No generated result becomes ready before QA.
- Provider/transient/moderation/QA errors remain distinguishable.
- Fake provider exercises every state.
- A separately authorized model capability smoke test is documented before deployment config changes.

## Phase 4 — Outfit Studio UI

Deliver:

- Request composer and three-variant result UI.
- Responsive studio shell.
- Real cutout flat lay.
- Consent/reference manager.
- Try-on progress and recovery states.
- Interactive image, hotspots, garment chips.
- Desktop popover/detail panel and mobile bottom sheet.
- Exact clothing-page link.
- Complete accessibility behavior.

Exit criteria:

- Full fake-provider E2E works on desktop and mobile.
- Keyboard users can select every garment.
- Low-confidence hotspot fallback remains usable.
- Ready/stale/failed states are visually clear.

## Phase 5 — locks, swaps, saved/manual/planner parity

Deliver:

- Lock/unlock.
- Constraint-safe swap.
- Remix unlocked pieces.
- Undo latest swap where practical.
- Immediate flat-lay update and try-on stale transition.
- Saved outfit, manual outfit, and plan visualization entry points.
- Save, plan, and mark-worn actions using canonical RPCs.

Exit criteria:

- Locked items never change during remix.
- Swaps are exact owned items and revalidated.
- Every supported outfit source uses one visualization pipeline.

## Phase 6 — feedback, analytics, private download, and delight

Deliver:

- Structured feedback.
- Privacy-safe analytics.
- Private labeled download.
- Stylist note and restrained motion.
- “Surprise me.”
- Useful underused-item moment.

Exit criteria:

- Analytics contain no private image or prompt data.
- Download is owner-only and labeled.
- Reduced-motion experience remains complete.

## Phase 7 — hardening and controlled rollout

Deliver:

- Full quality gates.
- Migration/backfill performance review.
- Worker concurrency and quota tuning.
- Evaluation report.
- Feature-flag rollout and rollback instructions.
- Monitoring thresholds.
- Documentation updates.
- A later, separate deprecation plan for the legacy candidate-preview path.

Exit criteria:

- `npm run check:quality` passes.
- Integration and E2E results are accurately reported.
- Privacy/security review issues are resolved.
- Production rollout does not depend on public storage or synchronous long-running request handlers.
- Old schema/path is not destructively removed during initial rollout.

---

# Acceptance criteria

Use these as executable completion checks.

## Recommendation

- Given an authenticated user with valid wardrobe items, when they request a rainy business-casual outfit, then each returned variant contains only their available items and satisfies rain/activity/formality constraints.
- Safe, Fresh, and Statement differ meaningfully in exact items or style dimensions.
- Every variant has a valid dress or top-plus-bottom foundation.
- A stylist-model invalid ID is rejected before reaching the UI.
- A locked item remains unchanged through remix.

## Flat lay

- Every selected garment uses its real current cutout or an explicit unavailable placeholder.
- Clicking a flat-lay garment opens the same detail model as the try-on image.
- Flat lay does not require or trigger an image-generation call.

## Consent and identity

- Try-on cannot be enqueued without active consent and an active validated reference.
- Upload validates decoded bytes and strips metadata.
- Reference replacement invalidates freshness.
- Revocation blocks future generation.
- Deletion removes/queues private bytes.

## Generation

- The provider receives Image 1 as identity and explicitly mapped garment inputs after it.
- The request builder does not send unsupported parameters.
- Portrait output is used.
- The first image must pass structured QA.
- One correctable failure produces at most one corrective generation.
- A second failure never becomes ready.
- Concurrent identical requests create at most one paid active job.

## Interaction

- Selecting shirt/pants/dress/layer/shoes/accessory opens the correct owned item.
- Details are database-sourced.
- **View clothing** routes to the exact item.
- Letterboxed images map hotspots accurately.
- Overlapping layers can both be selected.
- Keyboard chips work even without hotspots.
- Mobile uses an accessible bottom sheet.

## State and resilience

- Refresh during generation restores progress.
- A changed outfit makes a prior visualization stale.
- “Queue full” is not mislabeled “already fresh.”
- Retryable errors show Retry; terminal input errors show the relevant correction.
- A missing/deleted item fails safely.

## Privacy/security

- One user cannot read another user’s reference, visualization, snapshot items, feedback, download, or signed asset.
- Signed URLs are short-lived and never stored.
- Buckets remain private.
- Logs/analytics exclude raw private inputs.
- Account deletion covers all added rows and assets.

## Accessibility

- Entire flow works with keyboard only.
- Status changes are announced.
- Focus is trapped/restored for sheets/dialogs.
- Selected state is not color-only.
- Touch targets meet 44×44 minimum.
- Reduced motion is honored.

---

# Working instructions for Claude Code

1. Start by listing the verified current implementation seams, the files likely to change, the next migration filename, and a concise phase checklist.
2. Keep a living checklist in a feature implementation document so progress survives context compaction.
3. Implement, test, and verify one phase at a time.
4. Prefer extending established modules and RPC/job patterns over parallel abstractions.
5. Use exact domain types and Zod schemas at boundaries.
6. Keep route files thin.
7. Split logic at cohesive domain, ownership, or testability boundaries; do not split solely by line count.
8. Preserve unrelated dirty-worktree changes.
9. Do not stage or commit unless explicitly requested.
10. Do not run paid model calls without explicit authorization and appropriate credentials.
11. Do not change production model configuration merely because a guide names a newer model. Implement capability support, run an authorized smoke test, then document the deployment change.
12. Do not create fake fallbacks in production. Fake providers exist only for test/development under explicit configuration.
13. Do not weaken validation, RLS, privacy, or quotas to make the UI work.
14. Do not expose rejected QA images as ready.
15. Do not invent garment facts.
16. Do not infer body type or make fit claims.
17. If a current implementation already satisfies part of this specification, preserve it and add the missing tests instead of rewriting it.
18. When a blocker appears, exhaust safe read-only inspection and local alternatives, then report the exact blocker, evidence, affected phase, and smallest decision needed.

At the end, provide:

- A concise delivered-feature summary.
- Architecture and data-flow summary.
- Migration list.
- Environment/configuration additions.
- Privacy/security decisions.
- Tests actually run with results.
- Tests not run and why.
- Authorized manual/model evaluation still required.
- Rollout and rollback instructions.
- Known limitations, especially that virtual try-on is a style visualization and not physical fit prediction.

Do not call the work complete until the acceptance criteria and applicable quality gates above are satisfied.
