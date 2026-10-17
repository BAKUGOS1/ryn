# Phase 2 — Monitoring, signed webhooks and deadline automation

Phase 1 is published on `main`, commit `86150732f17614874b54b15cad6a26b56e66a673`. Phase 2 development branch: `phase-2/website-monitor`. Public publication was explicitly approved by the owner. No production deployment, hosted schema change, live billing or real notification send performed.

## Implemented source

- Paused monitor creation, activation/pause, verified team-member recipient, fixed immutable schemaVersion 1 snapshot; owner/admin/editor write permissions.
- One minute Inngest cron drives a Postgres dispatcher with bounded due-job claims (`FOR UPDATE SKIP LOCKED`), non-overlapping monitor jobs and transactional outbox.
- Outbox transport carries only tenant/job IDs, uses leased publishing, bounded attempt counts and recovery of lost/expired work. Postgres remains authoritative beyond the executor dedup window.
- Probe leases use fencing tokens, expiry and pause generations. Duplicate/stale workers cannot count another logical probe or change a later state. Paused/archived tenants are revalidated before recording effects.
- Two failures open one incident/run/delivery; sustained failures suppress duplicate transitions. First successful probe resolves the incident and queues one recovery notification. Recovery is recorded even if the run quota is exhausted, with notification skipped.
- Separate UTC-month counters + immutable idempotency ledger for probes (3,000), qualified runs (300), notifications (100). Three monitor safety ceiling; all shared by workspace, 15-minute minimum interval. These are development safety bounds, not verified commercial entitlements.
- Signed Inngest SDK v4 endpoint, explicit cloud mode and fail-closed configuration; scoped worker RPCs available only to service role. Server-only provider key adapter, explicit tenant args and composite FKs; no arbitrary service-role table DML in application code.
- Resend REST adapter, stable idempotency keys, bounded attempts, 23-hour retry cutoff, review state for permanent/uncertain stale outcomes. Provider retries do not create a second run/notification charge. Notification recipient membership/email revalidated before each send.
- Monitors workspace tab with pause/activate forms, incident history, transition evidence, check attempts and separate usage meters. No fake live data; missing migration/configuration produces setup guidance.

## SSRF and request controls

Exact operator host allowlist; HTTPS only; no IP literals, embedded credentials, custom ports, query parameters or fragments. All DNS results must be public unicast. Validated IP is pinned through Node HTTPS lookup with `autoSelectFamily:false`, original TLS hostname/SNI and certificate validation. No redirects or user headers. DNS 2s cap, request 10s cap, 64KiB body and 8KiB response-header cap. Failed target policies are not outages. Per-host database admission spacing of at least one second; two concurrent steps per tenant and ten global probe steps in executor.

Deployment-level restricted egress remains required before a commercial launch. Operator allowlisting is intentionally restrictive; this does not offer unrestricted public URL monitoring.

## Actual local verification

- 58 Phase 2 tests passed across database integration, network security/socket adapter, provider and endpoint suites.
- Includes full local failure/failure/repeated-failure/recovery journey with SQL migration and deterministic provider adapters, rollback injection, outbox publish failure, tenant isolation, quotas, lease replay, pause/resume and stale completion.
- Actual Node HTTPS adapter options/body timeout/size checks tested with a simulated socket; no real outbound endpoint claimed verified.
- Signed endpoint refuses unsigned requests with provider configuration and refuses all work when disabled.
- Full suite/build/lint/type/seed results are recorded in final validation below.

## Credential-dependent / operational gates still open

Hosted Supabase Auth/PostgREST and DB advisors; live Inngest registration/retries/cron; a controlled real HTTPS target; Resend sandbox account, verified sender and real test inbox; multi-connection PostgreSQL contention and load; hosted egress restrictions; mobile and authenticated browser journey. None is represented as passed by local test doubles.

All three Phase 2 trigger variants are implemented in source. The live-provider acceptance gate remains open. Visual editor source is described in `PHASE_3_DELIVERY.md`; commercial billing and AI are later phases. Phase 1 hosted/browser acceptance remains open.

## Run in a dedicated development environment

1. Review/apply all three ordered migrations (foundation, monitoring, event automations) to that project only.
2. Set the app's three foundation variables plus the server-only values in `.env.example`. `SUPABASE_SECRET_KEY` is a Supabase secret/service-role key and must NEVER have a `NEXT_PUBLIC_` prefix.
3. Keep `private` out of the Data API schemas. Never grant authenticated clients worker RPC execution. Run DB advisors.
4. Configure an exact allowlist of owned test hosts, a verified Resend sender and a controlled team inbox. Leave `MONITORING_ENABLED=false` until account/egress approval and test setup are complete.
5. Owner/operator can enable monitoring in that development environment and register `/api/inngest` with Inngest using its signing/event credentials. No dev-mode unsigned endpoint is supplied.
6. Create a paused monitor; activate; arrange two qualifying failures and one recovery; verify DB probe/incident/run/delivery records and real inbox; pause it again.

## Limitations requiring further hardening

- Dispatcher reconciliation updates currently scan eligible pending work; due admissions and outbox claims are bounded, but large-backlog recovery needs load measurement and batched reconciliation before scale.
- Scheduler preserves one in-flight check per monitor. Host spacing may defer a queued check until outbox recovery; timing is best effort, not a one-minute SLA.
- Retries can repeat an actual HTTP probe after a crash, while the logical probe/usage and incident transitions remain deduped. Infrastructure requests must be separately measured before pricing.
- Notification/provider delivery confirmation means provider acceptance, not proof a recipient read the message. An old down alert may be delivered after recovery during an outage; the subject/body represent their persisted transition.
- Editing published configuration creates a future new version; monitor editing remains fixed to its initial version and pause/resume. Webhook/deadline workflows supply separate draft/publish versioning and the constrained visual editor.

## Initial monitor verification (17 October 2026)

- Full suite: 86 tests across 7 files (28 foundation + 58 monitoring).
- Strict typecheck, ESLint and Prettier passed.
- Disposable two-organization seed passed with both migrations.
- Production build passed: compilation 3.8s, TypeScript 3.5s; worker/monitor routes included.
- Production dependency audit: 0 reported advisories; no blanket security claim.
- Initial build retry fixed a corrupted generated Turbopack persistence cache by clearing `.next`; application data was unaffected.
- Authenticated browser, mobile and live providers remain unverified as listed above. No end-to-end provider success claim is made.

## Signed webhooks and deadlines

Strict schema v1 allows typed scalar comparisons, email/internal-audit actions, at most 20 nodes/40 edges, one root, no joins/cycles/unreachable nodes and at most one email action. Client, route and worker share one Zod contract; SQL authoring has its own structural validation boundary.

Drafts have optimistic revisions. Publishing creates immutable versions; accepted events keep their original version across later edits. Pause/archive generation-fences pending and in-flight evaluation across resume. One-time deadlines validate explicit offset/IANA timezone consistency (including DST gaps), subtract lead minutes in UTC and persist one durable occurrence. Republishing supersedes old undispatched schedules.

Random 256-bit webhook signing secrets are shown once and AES-256-GCM encrypted in the private schema with authenticated tenant/source binding. A server-only keyring supports encryption-key rotation; signing-secret rotation immediately invalidates old revisions. Intake verifies exact bytes, timestamp and event ID with HMAC-SHA256 and a five-minute replay window. Persisted source determines tenant/version.

Streaming payload cap is 32 KiB; 60 source lookups/minute includes bad signatures; 1,000 accepted webhooks/workspace/UTC month. Workspace/workflow/event ID dedupe returns 200 for identical replay and 409 for conflicting bodies. Only configured scalar fields and a body hash persist. Non-matching events do not consume run/email units.

Bounded event outbox retries and fenced workers share the existing delivery adapter and workspace 300-run/100-email ceilings. Notification recovery works even with website probing disabled. Wire protocol and key rotation: `WEBHOOKS.md`. Current evidence: `VALIDATION.md`. Real providers and concurrency/load testing remain open gates.
