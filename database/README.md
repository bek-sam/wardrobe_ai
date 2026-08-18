# Database

This project owns deployable Supabase/PostgreSQL assets: configuration, immutable migration history, seed data, database tests, RLS, Storage policies, transactional RPCs, durable job state, and queue primitives.

Supabase CLI assets live in `database/supabase/`. Run CLI commands from the repository root with `--workdir database`, for example `npx supabase start --workdir database`. The initial move preserved every historical migration byte-for-byte.
