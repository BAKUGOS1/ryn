# Ryn — Phase 1 foundation + Phase 2 monitoring slice

**Product name: Ryn** (formerly FutureFlow). Public demo: https://ryn-workflows.vercel.app/. Repository: https://github.com/BAKUGOS1/ryn. The existing feature branch and draft PR remain the source. See `docs/BRANDING.md`.

A Next.js / Supabase foundation for an India-first automation SaaS. This branch adds the first monitoring vertical slice to the foundation. Webhook/deadline variants, graph editing and payments remain backlog. The supplied final plan remains authoritative; implementation decisions and deviations are in `docs/`.

**Status:** source implemented and locally tested. Hosted Supabase auth/database verification, a full signed-in browser journey, and 390px mobile verification remain open. Not certified production-ready. Source is published to GitHub; no deployment or live billing performed.

## Run locally

Requirements: Node 24 (tested 24.19.0), pnpm 11.25.0.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Visit `http://localhost:4173`. `/preview` is explicitly read-only sample data; the app has no fake login or in-memory production database. Without configuration, protected APIs return 503 and sign-in displays setup instructions.

## Connect a development Supabase project

1. Use a dedicated development project; no production migrations are authorized by this package.
2. Apply `supabase/migrations/20261016202055_foundation.sql` through that project's SQL editor after reviewing it. The migration is transactional. No hosted migration was run in this session.
3. Copy `.env.example` to `.env.local`, fill the project URL, **publishable** key and exact application origin. Do not add a service-role key. Use the same hostname consistently for cookies and Origin checks.
4. Enable email confirmations, disable anonymous sign-in, set Auth Site URL to the app origin and allow exact `/auth/callback`, `/auth/callback?next=/auth/update` redirects. Configure a development email provider or local inbox. Test the default PKCE email callback first. For token-hash email templates, use `/auth/confirm?token_hash={{ .TokenHash }}&type=email`; recovery uses `type=recovery`.
5. Keep `private` out of the Data API's exposed schemas. Default `public` exposure is sufficient. SQL grants and policies are included.
6. Restart the application; sign up, confirm email, create a workspace, invite a second verified email, then test access with each role. Invite links are shown once and must be manually shared. **No invitation email is sent.**
7. Run the hosted checklist in `docs/VALIDATION.md` before treating Phase 1 as accepted. Confirm Supabase's auth rate limits and CAPTCHA settings before any public exposure.

See `docs/PHASE_2_DELIVERY.md` for the monitoring/webhook/deadline pipeline, setup, actual test scope and remaining live gates. See `docs/PHASE_3_DELIVERY.md` for the visual editor and safe simulation. Monitoring is disabled by default and no services have been deployed.

## Foundation features

- Signup, login, logout, confirmation and password-recovery routes using Supabase SSR and fresh server identity verification.
- Organization create/read/update/switch; owner-only reversible archive retains audit records.
- Owner/admin/editor/viewer permissions; live DB membership checks; suspended members lose access immediately.
- Email-bound, seven-day, single-use invite links; hashed tokens, revocation, row locks, permission revalidation on acceptance.
- Original responsive overview, onboarding, members and settings screens.
- RLS on all exposed tables; tenant composite invitation FK; authenticated read grants; guarded transactional RPC writes, audit log, seat/org/mutation bounds.

The noncommercial foundation permits up to 20 active seats and 5 owned active workspaces to exercise team functionality. These are safety bounds, **not the proposed Free plan**. Phase 4 must implement versioned commercial entitlements before launch.

## Validate

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm db:seed
pnpm build
# In another terminal: pnpm start (no Supabase env for the setup-mode suite)
pnpm test:e2e
```

`pnpm test` runs real PostgreSQL SQL/RLS through PGlite with simulated Supabase Auth schema/identities, plus route and validation tests. It does not exercise GoTrue, PostgREST, real email or multiple concurrent DB connections. `db:seed` creates two organizations in a disposable local engine and exits; it never touches a remote database. HTTP E2E tests require the application reachable from the test process. Browser-specific tests are separate in `tests/browser`, runnable with `pnpm test:browser` after installing Playwright Chromium.

## Structure

- `src/app`: routes and pages
- `src/features/organizations`: runtime schemas, role matrix and domain types
- `src/lib`: environment, session, HTTP validation and Supabase adapters
- `src/components`: server shell and small client-side form islands
- `supabase/migrations`: reviewed SQL source of truth
- `tests`: SQL isolation, auth/role boundaries, input validation, HTTP E2E
- `docs`: audit, ADRs, data model, security, roadmap and actual validation evidence

## Toolchain decisions

Next 16.4.2 / React 19.3.1 / Supabase SSR 0.12.7 / Supabase JS 2.118.0 are pinned with lockfile. TypeScript 7 failed the current typescript-eslint parser; TypeScript 6.0.3 is pinned. ESLint 10 has incompatible React/import/a11y plugin peers; ESLint 9.39.5 is pinned for compatibility although npm flags it unsupported. Track a coordinated lint-tool upgrade before launch. These development tools are not shipped as runtime auth infrastructure.

Read `THIRD_PARTY_NOTICES.md` before redistribution. No third-party starter was cloned wholesale. Inngest SDK (Apache-2.0) and ipaddr.js (MIT) are maintained dependencies, pinned for Phase 2. No credentials are included. See `docs/ROADMAP.md` and `docs/CODEX_HANDOFF.md` for current scope and remaining release gates. Billing and AI are not activated.
