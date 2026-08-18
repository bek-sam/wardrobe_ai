# Backend

The public Wardrobe application API. It owns authentication at the application boundary, business use cases, transactional coordination, authorization, and adapters for Supabase/PostgreSQL, Storage, queues, and external context providers.

Code is organized by business capability under `src/modules`, not by global controller/service/repository layers. Each capability exposes one application surface; HTTP code validates and delegates instead of orchestrating tables directly.

The migration starts with read-only Catalog and Insights capabilities. Until a capability is cut over and parity-tested, its implementation remains in the root transition application.
