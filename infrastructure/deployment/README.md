# Deployment

Deploy Frontend, Backend, Worker, and AI orchestration independently. Route same-origin `/api/v1/*` traffic to Backend at the edge. Keep AI orchestration on a private network with workload authentication. Frontend receives no service-role, worker, or provider secret.

Frontend and Backend are stateless standalone Next images and may scale
horizontally behind a load balancer. Worker replicas coordinate only through
leased PostgreSQL rows (`FOR UPDATE SKIP LOCKED`); do not add in-memory queue
truth. AI Orchestration is stateless and may scale independently, but its
private token and provider keys must be injected only into that workload.

Use the four Dockerfiles under `infrastructure/docker/` as independent build
targets. The Frontend runtime stage contains only the standalone Frontend
bundle—not Backend, Worker, database migrations, provider SDKs, or source.

Database migrations are a deliberate release step. Worker and API releases must remain compatible with both the previous and next additive contract/database version during rolling deployment.
