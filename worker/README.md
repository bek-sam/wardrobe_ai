# Worker

The worker owns process lifecycle, bounded concurrency, claim loops, leases, heartbeats, retry classification, graceful shutdown, and operational metrics. Product job state remains in PostgreSQL; handlers call task-specific AI endpoints over private HTTP.

The private Storage-deletion handler is the first active family. It continuously claims leased rows, validates the bucket and user-owned path, removes bytes, and only then invokes the transactional completion RPC. Start exactly one or more Worker replicas with `npm run start -w @wardrobe/worker`; `SKIP LOCKED` leases keep their claims disjoint.

The remaining durable processors move one family at a time after their contracts and parity tests exist. They continue to run through the transition application until cut over.
