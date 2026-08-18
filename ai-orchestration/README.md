# AI orchestration

This private, stateless service owns provider credentials, model selection, prompt/schema versions, provider timeouts, task budgets, redaction, and evaluation gates. It has no database access and never commits product truth.

Every model capability receives a narrow authenticated endpoint and a task-specific contract. A generic prompt endpoint is forbidden. Database IDs and signed media URLs are minimized to exactly what a task needs.
