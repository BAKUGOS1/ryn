# Ryn continuation

Current brand: **Ryn**. Assigned new public domain: https://ryn-workflows.vercel.app/. See `BRANDING.md` for rename state, compatibility identifiers and the latest verification. Older deployment receipts below retain their original source/URL evidence.

Repository: https://github.com/BAKUGOS1/ryn
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

Deployment handoff: `DEPLOYMENT.md`. The owner authorized publishing, then deferred Vercel reconnection and backend setup. The Vercel connector requires reauthentication; no deployment exists from this session. `vercel.json` supplies Next.js install/build commands. Deploy the tested feature branch, not the older foundation on main; keep worker/indexing flags disabled for the initial public demo.

Public demo deployed after Vercel reconnection: https://futureflow-livid.vercel.app/ — production READY, deployment `dpl_4iiL6Jysb5RVt9BcTwz3JExtu81g`, source `3c6d90e62195ad4b25f97686321448d6ff52ee6d`. This supersedes the earlier authentication blocker. See `DEPLOYMENT.md` for actual live fetch/browser evidence. Backend/provider setup remains deferred; worker/indexing flags are false. Do not confuse the deployed source commit with later documentation-only commits or claim live automation acceptance.

## Live Ryn deployment receipt

- Public URL: https://ryn-workflows.vercel.app/
- Same Vercel project ID, now named `ryn`; repository https://github.com/BAKUGOS1/ryn; draft PR https://github.com/BAKUGOS1/ryn/pull/1 remains unmerged.
- Production deployment `dpl_7C8Q6hpFso8U4cFf9Pz76pjHgxva`: **READY**, no alias error, source `a3790131d08918bba3ae6ba6159353d7b6326413`. Build approximately 29 seconds. Both the new public URL and the existing `futureflow-livid.vercel.app` alias point at this build.
- Live direct fetch: eight public/setup/SEO routes returned 200 with Ryn titles and new canonical URLs where applicable; no former product name appeared in their responses. Preview/auth remain noindex. Robots still disallows crawling and sitemap has no indexed entries. Unconfigured organizations API returns 503.
- Cloud browser opened the public Ryn homepage and navigated to the sample studio on the new domain. This is public demo verification, not hosted authentication or live automation acceptance.
- Runtime error-log/drain acceptance was not performed. No hosted migrations, real notification, paid feature, billing or indexing activation. Source commit differs from later documentation-only receipt commits.
