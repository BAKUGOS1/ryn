# ADR 002: Inngest, beginning Phase 2

Accepted architecture; not integrated in Phase 1. SDK exposes retries, idempotency, cancellation and concurrency and fits a Next.js endpoint. Keep Postgres events, outbox and run ledger authoritative.

| Choice      | Benefit                                                       | Cost / risk                                                                                       | Decision |
| ----------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| Inngest     | Step functions, Next endpoint; minimal new deployment surface | Provider unit costs and retry windows need live prototype; SDK Apache differs from server license | Select   |
| Trigger.dev | Explicit typed tasks and worker lifecycle                     | Separate task deployment; no demonstrated need yet                                                | Defer    |
| Hatchet     | Typed workflows and worker control                            | Worker operations / self-hosting burden; cloud terms unverified                                   | Defer    |

One global bounded due-job dispatcher writes outbox transactionally; publish through relay. Tenant concurrency, retry classification, persistent dedup and provider reconciliation remain our responsibility. No blanket exactly-once promise. Validate cancellation, outage replay and actual unit cost before Phase 2 gate.
