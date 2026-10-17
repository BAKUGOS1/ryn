# FutureFlow continuation

Repository: https://github.com/BAKUGOS1/futureflow
Working branch: `phase-2/website-monitor`; draft PR #1. Foundation is on `main`. Keep changes on the feature branch until review. Do not merge/protected-push, deploy, apply hosted migrations, send real notifications or activate live billing without the owner's approval.

Read `FUTUREFLOW_FINAL_MASTER.md` in full, especially Section 17. It remains the product source of truth. Start from the current branch, not a new scaffold. Current architecture: Next.js + React + Supabase SSR/RLS, guarded database RPCs, Postgres durable records/outboxes, signed Inngest execution and Resend adapter. No unrelated connected Supabase project was modified.

Source implemented: Phase 0 audit/ADRs; Phase 1 multi-tenant foundation; Phase 2 website incident/recovery, signed webhook and deadline variants; initial Phase 3 visual editor and safe simulation. See delivery docs for exact limits. Full SaaS and live acceptance are not complete. Missing credentials must not be replaced with fake success paths.

Next work in order:

1. Fix any failing current CI/browser checks; read `VALIDATION.md` and the draft PR status. Review the new event-automations migration before applying it anywhere.
2. Provision/link a dedicated development Supabase project with owner approval, apply all ordered migrations there, configure confirmed-email Auth and two real test accounts, run PostgREST/RLS/advisors and signed-in authoring/browser checks.
3. With controlled test providers and approved recipients, exercise actual Inngest cron/retries, owned HTTPS target and Resend test inbox. Run multi-connection PostgreSQL race/load tests; PGlite is single-connection coverage.
4. Finish Phase 3 acceptance with real desktop/390px authoring, onboarding/user feedback, unsaved-change handling and layout persistence if needed. Preserve the same compiler contract.
5. Phase 4: commercial entitlements, Razorpay **sandbox only**, signed/replay-safe/out-of-order billing events and reconciliation. Current safety caps are not product plans. Do not add a checkout stub that grants access from a browser callback.
6. Phase 5: bounded supported-only AI drafts (never publish/execute), AI metering, telemetry/load/security review and actual backup/restore drills. Phase 6 requires real pilot users, observed economics and staged launch approval.

Commands: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm db:seed`, `pnpm build`; start on port 4173, then `pnpm test:e2e` and `pnpm test:browser` (install Chromium). No real secret belongs in git or chat. `.env.example` documents disabled-by-default settings.

Latest optimization pass: see `OPTIMIZATION.md` for public discovery pages, indexing launch gate and editor safeguards. Billing remains deferred at the owner's request. Keep `SITE_INDEXING_ENABLED=false` until approved launch with the final APP_ORIGIN; rebuild after changing these values. The latest PR checks are authoritative for browser results.

Core-workflow continuation: read `CORE_WORKFLOW_AUDIT.md`. Latest source adds delivery/run evidence synchronization (fourth migration), correct expired-delivery classification, editor revision handling and guarded form submissions. 150 local tests pass. Do not reapply older migrations or assume the fourth migration has been applied to a hosted project. Inspect current remote head and PR CI before continuing. Billing remains deferred. Prioritize dedicated hosted Auth/PostgREST and signed-in acceptance after owner-approved setup; local tests are not provider verification.
