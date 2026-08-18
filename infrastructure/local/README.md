# Local topology

Local development must mirror production protocols with separate processes:

| Process          | Default address          | Calls                                         |
| ---------------- | ------------------------ | --------------------------------------------- |
| Frontend         | `http://127.0.0.1:3000`  | Backend through HTTP                          |
| Backend          | `http://127.0.0.1:3001`  | Supabase, queue, AI orchestration, Open-Meteo |
| AI orchestration | `http://127.0.0.1:3002`  | OpenAI only                                   |
| Worker           | no public port           | Supabase/queue and AI orchestration           |
| Supabase         | CLI-assigned local ports | PostgreSQL, Auth, Storage                     |

Do not replace a network call with an implementation import in local development.

Run all real deployables with:

```bash
docker compose --env-file .env.local -f infrastructure/local/compose.yaml up --build
```

AI Orchestration and Worker publish no host port. The explicit environment
allow-lists prevent the shared local env file from being injected wholesale
into Frontend. Private services retain outbound access to Supabase, weather,
and provider APIs; enforce narrower egress with production network policy. For
horizontal testing, use `docker compose ... up --scale worker=3`; database
leases make duplicate delivery safe. `WORKER_CONCURRENCY` controls bounded
vertical concurrency per replica.
