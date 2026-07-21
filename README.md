# Wardrobe AI

Wardrobe AI is a private, account-based clothing assistant built with Next.js, TypeScript, Supabase, OpenAI, and Open-Meteo. It turns owned garments into a searchable wardrobe, source-backed product research, weather-aware outfit recommendations, future plans, wear history, and personal insights.

The original Vite prototype is still available through the `legacy:*` scripts while the production application runs from the Next.js App Router.

## What is implemented

- Supabase signup, login, password recovery, server sessions, protected routes, and onboarding profiles.
- PostgreSQL migrations for wardrobe items, private image lineage, durable imports, research, outfits, plans, wear history, feedback, chat, agent traces, usage controls, export, and deletion.
- Row Level Security and private Storage policies scoped to the authenticated user.
- Manual wardrobe CRUD plus search, filters, favorites, availability, wear actions, and signed image URLs.
- Multi-garment photo intake with decoded-image validation, EXIF removal, crop review, extraction review, metadata correction, retries, and idempotent confirmation.
- Product research with web evidence, confidence states, and field-by-field acceptance.
- Open-Meteo geocoding/forecast context and deterministic clothing constraints.
- Deterministic candidate filtering/scoring before structured OpenAI stylist and planner calls.
- Exact-owned-item outfit validation, atomic outfit/planner/wear RPCs, swaps, feedback, and insights.
- Responsive public, auth, Today, Wardrobe, Import, Stylist, Planner, Outfits, Insights, and Settings experiences.
- Vitest unit tests, Playwright smoke tests, ESLint, Prettier, strict TypeScript, and GitHub Actions CI.

AI and data-backed features fail closed until their required environment variables are configured. No sample wardrobe is presented as user data.

## Requirements

- Node.js 22.12 or newer.
- npm 10 or newer.
- A Supabase project, or the Supabase CLI for local development.
- An OpenAI API key for vision, extraction, research, styling, and planning.

## Local setup

```bash
npm install
cp .env.example .env.local
```

Start Supabase locally and apply the migrations:

```bash
npx supabase start
npx supabase db reset
```

Copy the local Supabase URL, publishable key, and service-role key into `.env.local`. Add the OpenAI model IDs you have selected; model names are intentionally not hard-coded in application source.

Then run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

The complete template is in [`.env.example`](.env.example). The minimum configuration for the account-backed app is:

```dotenv
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

AI routes additionally require:

```dotenv
OPENAI_API_KEY=
OPENAI_VISION_MODEL=
OPENAI_IMAGE_MODEL=
OPENAI_RESEARCH_MODEL=
OPENAI_STYLIST_MODEL=
OPENAI_PLANNER_MODEL=
```

`SUPABASE_SERVICE_ROLE_KEY`, OpenAI keys, and worker secrets are server-only. Never prefix them with `NEXT_PUBLIC_`.

## Commands

| Command                                      | Purpose                               |
| -------------------------------------------- | ------------------------------------- |
| `npm run dev`                                | Start the Next.js development server  |
| `npm run build`                              | Build the production app with webpack |
| `npm run start`                              | Run the production build              |
| `npm run lint`                               | Run ESLint                            |
| `npm run typecheck`                          | Run strict TypeScript checks          |
| `npm test`                                   | Run Vitest unit tests                 |
| `npm run test:e2e`                           | Run Playwright end-to-end tests       |
| `npm run format:check`                       | Verify Prettier formatting            |
| `npm run check`                              | Run every local quality gate          |
| `npm run legacy:dev`                         | Run the preserved Vite prototype      |
| `npm run migrate:legacy -- --user-id <uuid>` | Dry-run local JSON migration          |

Add `--apply` to the legacy migration only after reviewing its dry-run output and configuring Supabase. The migration is scoped to one explicit destination user and is safe to rerun.

## Background processing

Imports and product research are durable database jobs. A trusted scheduler should call the internal worker routes with `IMPORT_WORKER_SECRET`:

- `POST /api/internal/imports/process`
- `POST /api/internal/research/process`
- `POST /api/internal/storage/process`

Interactive routes can also process one owned import or research job, but production deployments should use a scheduler so work survives browser refreshes and request timeouts. The storage worker drains private-object deletions queued by item and import cleanup with leased, retryable tasks.

## Architecture and trust

- [Architecture](docs/architecture.md)
- [Runtime agents and deterministic services](docs/agents.md)
- [Data model](docs/data-model.md)
- [Storage and RLS security](docs/storage-security.md)
- [Privacy](docs/privacy.md)

The repository’s [`.agents/skills`](.agents/skills) are development-time automation instructions. They are separate from the authenticated runtime agents under `src/lib/ai/agents`.

## Deployment

The intended production topology is Vercel plus Supabase. Before a private beta:

1. Apply all Supabase migrations in order.
2. Configure Auth site/redirect URLs for the production domain.
3. Set every server/client environment variable in the deployment environment.
4. Configure worker scheduling and secrets.
5. Run `npm run check` and authenticated two-user RLS integration tests.
6. Verify account export and deletion against a disposable production-like user.

## Original prototype

The upstream project’s local gallery and image-import algorithms remain useful references. Existing screenshots are under `docs/screenshots`, while the modularized legacy UI and Vite middleware remain in `src/*.jsx`, `src/features/import`, and `scripts/import-api` until final parity is accepted.

## License

[MIT](LICENSE)
