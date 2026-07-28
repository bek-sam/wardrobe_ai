# Runtime AI and tools

Wardrobe AI uses a small orchestrated set of model calls. Database retrieval, authorization, weather lookup, image validation, filtering, scoring, feedback aggregation, and transactional writes are normal code—not autonomous agents.

## Wardrobe Orchestrator

The orchestrator classifies the user-visible request into one of five intents and routes it to the capability that can actually answer it. It has no unrestricted database connection; every tool is scoped to the authenticated user.

| Intent           | Route                                                                      | Model calls |
| ---------------- | -------------------------------------------------------------------------- | ----------- |
| `outfit_request` | stored-candidate retrieval, then stylist composition                       | stylist (1) |
| `planning`       | planner agent over the requested date window                               | planner (1) |
| `packing`        | planner agent at the destination's forecast, collapsed into a packing list | planner (1) |
| `insight`        | deterministic wear-history/composition analytics                           | none        |
| `item_question`  | deterministic user-scoped wardrobe lookup                                  | none        |

Classification is keyword-driven and free; only genuinely ambiguous text escalates to one small structured model call, and an unconfigured or failing call keeps the deterministic route. Date windows, trip destinations, insight periods, and lookup terms are always extracted deterministically. A "planning" request that resolves to a single day is treated as an outfit request rather than spending a planner call on one look; the generate-and-save endpoint always takes the outfit route.

Trip-destination extraction is case-insensitive: `pack me for chicago` and `Pack me for Chicago` resolve identically, and the casing the user wrote is preserved rather than respelled. It strips leading durations (`packing for 3 days in new york` → `new york`), trailing dates and weekday clauses, and punctuation, while keeping place-name connectors (`rio de janeiro`, `The Hague`, `stratford upon avon`). Weekdays, seasons, weather words, and generic places (`work`, `home`, `office`) are never treated as destinations. The extractor makes no model call and no geocoder lookup.

### Intent → quota matrix

Intent is resolved **once**, at the authenticated chat boundary, before any budget is charged; the resolved route is then threaded through to the orchestrator so a turn is never classified twice. Each route pays exactly its own cost:

| Intent                  | Rolling bucket          | Daily generation unit    |
| ----------------------- | ----------------------- | ------------------------ |
| `item_question`         | `wardrobe_query`        | none                     |
| `insight`               | `wardrobe_query`        | none                     |
| `outfit_request`        | `stylist_generation`    | 1 × `stylist_generation` |
| `planning`              | `planner_generation`    | 1 × `planner_generation` |
| `packing`               | `planner_generation`    | 1 × `planner_generation` |
| _classifier escalation_ | `intent_classification` | none                     |

The deterministic routes answer from the user's own rows and call no model, so they spend no daily AI budget — only a rolling abuse limit. Planning and packing both run the planner agent and therefore never touch the stylist budget. Escalating ambiguous text to the classifier is a routing cost, not a generation: it takes its own rolling limit (so routing cannot be used as an unmetered model endpoint) and increments no daily counter. Quota is charged only at the request boundary, never inside the shared planner pipeline, so a route that fans out internally cannot double-bill.

The mapping lives in one pure module (`src/lib/usage/intent-quota/policy.data.ts`) and is asserted directly in unit tests, so handler changes cannot silently re-price a route. `/api/outfits/generate` remains outfit-only on the stylist budget, and `/api/plans/generate` remains planner-only on the planner budget.

### Running without OpenAI

Chat is gated on the account, not on a model. With every OpenAI variable unset:

- `item_question` and `insight` work normally — they read the user's own rows.
- `outfit_request` returns a typed `503 stylist_model_unavailable`.
- `planning` and `packing` return a typed `503 planner_model_unavailable`.

Both errors name the routes that still work rather than presenting the stylist as broken, and no route ever fabricates a result when its model is missing. The UI reflects the same capability split; the server enforces it independently.

For the outfit route, the result is rejected unless every selected item:

- was supplied in the candidate set;
- belongs to the current user;
- is active, undeleted, and available;
- matches its declared outfit role; and
- forms exactly one valid dress or top/bottom foundation.

## Visual Cataloging Agent

One Responses API call detects all garments in an uploaded image and returns strict structured fields: bounding boxes, category/subcategory, colors, pattern, silhouette, apparent material, visible text, suggestions, and per-field confidence.

Visible text is kept separate from interpreted identity. The agent must not infer an exact brand from general appearance.

## Image Extraction Service

Image extraction combines the image model with deterministic processing:

- normalized source and reviewed crop;
- a deliberately removable chroma background;
- color-distance cleanup and edge/spill suppression;
- completeness/framing diagnostics;
- bounded regeneration attempts;
- explicit user approval.

Modeled previews are separate, opt-in, marked AI-generated, and never represented as physically accurate fit.

## Product Research Agent

Research runs only when requested. It uses user-confirmed brand/product clues, visible text, model/SKU/barcode clues, and OpenAI web search. Results are stored as proposals with evidence and one of `verified`, `likely`, `uncertain`, or `not_found`.

Official brand evidence is preferred, then reliable retailers. Visual similarity alone is never proof. Proposed fields cannot overwrite user-confirmed values and are applied only through an explicit acceptance RPC.

## Stylist Agent

The stylist receives compact metadata for a filtered set, not the entire wardrobe or every original image. It returns strict structured output containing exact candidate IDs, title, explanation, warnings, confidence, an optional missing category, and at most one useful follow-up question.

The model is responsible for coherent style reasoning and explanation. Hard ownership, availability, weather, foundation, and role rules remain deterministic.

## Planner Agent

The planner creates one unique look per requested date from each day’s eligible IDs. It minimizes needless repeats, respects laundry/availability and forecasts, and may reuse versatile layers. Every returned date, ID, foundation, and combination is validated before save.

### Explicit chat-plan saving

Chat never auto-saves a plan. A planning answer arrives with `saved: false` and an explicit **Save plan** action; the answer copy says the plan was not saved automatically and points at that action.

- Only `kind: "plan"` / `intent: "planning"` answers are saveable. Packing lists stay advisory in this iteration and deliberately record nothing the save RPC could act on — no save action appears for packing, insights, item questions, or outfits.
- The browser sends **only** a `generationId` to `POST /api/plans/generated`. It never submits plan days or item IDs, so a client cannot invent a plan or smuggle in items it does not own.
- The days are replayed from the safe representation the server recorded in `agent_runs.output_summary.plans`: date, occasion, the already-published weather subset, title, explanation, confidence, and owned item IDs with resolved roles and sort order. No prompts, reasoning, secrets, profile data, wardrobe rows, coordinates, or private location fields are stored there.
- The write goes through `save_recorded_generated_week` → `save_generated_week` → `save_generated_plan` → `save_generated_outfit`, so every existing ownership, activity, availability, role, and foundation check still applies. If any day fails, the whole week rolls back and nothing is created.
- Saving is idempotent: a transaction advisory lock keyed on user + generation serialises concurrent clicks, and an already-saved generation returns the plan/outfit IDs it created the first time instead of duplicating a week.
- On success the RPC flips the stored assistant message's `structured_result.saved` to `true`, so reloading the conversation shows the plan as saved rather than re-offering the action.

## Model and trace policy

- Model IDs live only in environment configuration.
- Responses use strict Zod-backed formats.
- Calls use per-user safety identifiers and do not request provider-side response storage.
- Retries and timeouts are bounded.
- `messages` stores only visible chat and structured UI results.
- `agent_runs` stores safe input/output summaries, tools, model, latency, and usage.
- Hidden chain-of-thought, API secrets, and raw private image content are never persisted.
