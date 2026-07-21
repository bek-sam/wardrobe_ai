# Runtime AI and tools

Wardrobe AI uses a small orchestrated set of model calls. Database retrieval, authorization, weather lookup, image validation, filtering, scoring, feedback aggregation, and transactional writes are normal code—not autonomous agents.

## Wardrobe Orchestrator

The orchestrator classifies the user-visible request, gathers authenticated preferences, weather, and owned candidates, then invokes the stylist only after deterministic filtering/scoring. It has no unrestricted database connection; every tool is scoped to the authenticated user.

Its final result is rejected unless every selected item:

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

## Model and trace policy

- Model IDs live only in environment configuration.
- Responses use strict Zod-backed formats.
- Calls use per-user safety identifiers and do not request provider-side response storage.
- Retries and timeouts are bounded.
- `messages` stores only visible chat and structured UI results.
- `agent_runs` stores safe input/output summaries, tools, model, latency, and usage.
- Hidden chain-of-thought, API secrets, and raw private image content are never persisted.
