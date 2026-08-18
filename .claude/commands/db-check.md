---
description: Run the DB-backed suites (local Supabase + integration + authenticated E2E)
allowed-tools: Bash, Read, Edit, Grep, Glob
---

Run the suites that `npm run check:quality` does **not** cover. These are the ones
that catch real RLS, RPC, and migration bugs.

Run each step in order and stop at the first failure:

1. `npx supabase start --workdir database` — skip if `npx supabase status --workdir database` already reports running.
2. `npx supabase db reset --workdir database` — applies `database/supabase/migrations` in filename order.
3. `npm run test:integration`
4. `npm run test:e2e`

Reporting rules — these matter more than the run itself:

- **Never report a suite as passing unless you saw it exit 0.** `check:quality`
  passing is not evidence about integration or E2E.
- Paste the actual failure output for anything that fails. Do not summarize a
  failure as "a minor issue".
- If you skip a step, say which one and why.
- If Docker isn't running, say so plainly — that is a blocked run, not a pass.

Known trap when triaging E2E failures: the authenticated specs share one account
and are order-dependent while `fullyParallel` is on. A failure that only appears
under parallel execution is likely this, not the code under test — confirm by
re-running the single spec before chasing it.
