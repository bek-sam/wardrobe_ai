# Functional-boundary decision record

Status: accepted and implemented
Date: 2026-08-14

## Decision

Wardrobe AI uses two complementary kinds of boundary:

1. **Physical projects by runtime responsibility and trust:** Frontend,
   Backend, Worker, AI Orchestration, Database, and Contracts.
2. **Modules by product capability inside a runtime:** Account, Catalog, Intake
   & Research, Context, Style Engine, Looks & Planning, Studio, Insights, and
   Platform.

This satisfies independent deployment and safety without turning every feature
or table into a network service. Frontend is a real application layer—it owns
presentation, accessibility, browser interaction, and temporary UI state—but
it never owns authorization, durable truth, provider access, or business
invariants.

## Why these physical boundaries

| Boundary                          | Reason to separate                                                                                                              |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Frontend ↔ Backend                | public/browser trust boundary; prevents secrets and privileged implementation from entering bundles; independent UI/API scaling |
| Backend ↔ Worker                  | request latency and availability differ from durable, retryable, resource-heavy work                                            |
| Backend/Worker ↔ AI Orchestration | provider credentials, prompts, model policy, cost/rate limits, and failure modes need one private owner                         |
| Services ↔ Database project       | schema/RLS/Storage changes require ordered, reviewable, independently applied migrations                                        |
| Every runtime ↔ Contracts         | transport compatibility must not require importing another service's implementation                                             |

## Why capabilities remain modules rather than more services

Account, Catalog, Looks, and Insights share authorization, transactions, and
data. Splitting each one into a separate network/database service now would add
latency, distributed consistency, more secrets, and operational burden without
a proven scaling benefit. Extract another service only when measurements show
an independent scaling/reliability/release requirement and its data ownership
can be made unambiguous.

## Design rules

- One owner for every write, state machine, private Storage path class, and
  invariant.
- Transports authenticate, parse, invoke one use case, and map a typed result.
- AI output is an untrusted proposal. Deterministic code and database
  transactions authorize changes.
- Long-running work is a durable job with idempotency, leases, bounded attempts,
  retry classification, and terminal states.
- Cross-service communication is versioned HTTP/event data, never a relative
  source import or shared process memory.
- File boundaries follow cohesion, not a minimum or maximum number of lines.

The complete ownership map and flows are in [architecture.md](architecture.md).
