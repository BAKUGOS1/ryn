# Phase 2: first vertical slice

Build on branch `phase-2/website-monitor` after the Phase 1 snapshot on main. Public source publication explicitly authorized on 17 October 2026. No deployment, hosted DB migration or real email sends are authorized by this implementation task.

Scope: immutable fixed monitor version; constrained HTTPS endpoint; a minute dispatcher with Postgres due-job claims and transactional outbox; Inngest step execution; two qualifying failures -> one incident + one email; first successful recovery resolves and notifies; persisted probe/run/delivery evidence; pause/resume, tenant isolation, separate probe/run/notification safety meters. This was the initial monitor slice. Signed webhook/deadline variants and editor source now extend it; see `PHASE_2_DELIVERY.md` and `PHASE_3_DELIVERY.md`.

SSRF: exact operator-controlled host allowlist, HTTPS only, no credentials/query/fragment/custom ports, resolve all addresses and require public unicast, pin DNS address through Node HTTPS lookup with TLS hostname verification, no redirects, no user headers, timeout/byte bounds, max 1 request per second per hostname in DB. Additional deployment-level egress restrictions remain a live gate.

Worker auth: signed Inngest endpoint; service key server-only and limited adapter functions with explicit tenant IDs and composite FK checks. Do not accept organization from customer events as authority. Scheduled jobs load their persisted tenant. RLS for user-facing reads; writes recheck current roles.

Delivery: provider idempotency key + local fenced attempt. Resend dedup window is 24h; stop automatic sending after 23h from first attempt and flag review. Never retry an ambiguous outcome outside that window. At-least-once transport; persistent DB dedup is authoritative. Missing keys disable worker endpoint and monitor activation.

Acceptance: actual SQL two-tenant and state transition tests, duplicate/stale fence attempts, pause/archive, quotas, outbox, retry classification, DNS rebinding/private IP/redirect/limits, email idempotency window, and a local integrated failure-failure-failure-recovery scenario. Real Supabase/Inngest/Resend accounts and live network probe/provider acceptance remain explicit blockers.
