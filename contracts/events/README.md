# Durable event contracts

Queue messages carry only a versioned envelope, job type, correlation and idempotency metadata, and the owning job ID. The database job row remains workflow truth. Additive event changes keep the same version; breaking changes introduce a new event schema and a migration window.

The current TypeScript representation is in `src/events.ts`. A schema file will be generated beside this document before the first worker handler is cut over.
