# Validation evidence — 17 October 2026 (Asia/Kolkata)

## Latest core-workflow pass

This section supersedes older result counts and statements about local HTTP/browser execution below. Starting remote head was `d6d15d9` with no newer changes.

- **150 tests pass across 15 Vitest files**, including real SQL migration/RLS/RPC execution, deterministic provider adapters, route authorization adapters, draft revision lifecycle and client failure handling.
- Three new SQL regressions first failed against the previous schema: quota-skipped notification trace; retry-exhaustion trace; expired delivery plus unavailable recipient. They pass with the new follow-up migration.
- ESLint, strict typecheck, disposable four-migration seed and production build pass. Public pages remain static; private routes remain dynamic/no-store.
- All **5 HTTP smoke checks pass locally** against the production build. Desktop/390px browser results are recorded in the latest draft PR check after execution. The prior verified run 39022325963 passed all 5 HTTP and 10 public browser checks.
- New migration `20261017122144_workflow_delivery_evidence.sql` was exercised in disposable PGlite only; no hosted schema was changed. Hosted Auth/PostgREST, authenticated browser authoring and real provider gates remain open.

See `CORE_WORKFLOW_AUDIT.md` for findings, corrections and exact missing integration inputs. Older sections below are historical evidence, not the current release status.

## Executed here

| Check                               | Actual result                                                                          | Scope                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `node_modules/.bin/vitest run`      | **28 passed**, 3 files, 5.13s final run                                                | 18 PostgreSQL-policy tests, 7 validation/RBAC tests, 3 route tests |
| `node_modules/.bin/tsc --noEmit`    | Passed, exit 0                                                                         | Strict application + test typing                                   |
| `node_modules/.bin/eslint .`        | Passed, no warnings in final run                                                       | Application/test source                                            |
| `node --import tsx scripts/seed.ts` | Passed, ALPHA and BETA created                                                         | Disposable local engine only                                       |
| `node_modules/.bin/next build`      | Passed; compilation 2.8s, TypeScript 4.7s                                              | Optimized production build                                         |
| `pnpm audit --prod --json`          | 0 reported advisories across severity levels                                           | Registry audit, not a security certification                       |
| Browser desktop inspection          | Landing → preview → Members → Settings worked; dashboard screenshot visually inspected | Read-only preview, no hosted login                                 |

Final SQL tests execute the actual migration in PGlite, a PostgreSQL engine, with an Auth schema fixture and role switching. They test real GRANT/RLS/function behavior, not a mocked database. Auth service/JWT signature verification is **not** part of these SQL tests. Server route tests mock identity/database adapters deliberately.

Security coverage: cross-tenant reads and RPC writes, direct DML denial, anonymous/unverified users, owner/admin privilege escalation, suspended memberships, composite tenant FKs, invitation wrong-email/expiry/revocation/replay, hidden token hashes, changed inviter privilege, archive retention and mutation throttling.

## Attempted but blocked — not passed

`node_modules/.bin/playwright test` attempted 4 HTTP E2E checks. The runner could not connect to the supervised application (`ECONNREFUSED` for localhost, then `ENETUNREACH` for terminal.local). A curl check also timed out. The dedicated cloud browser could access the supervised preview. This is a network boundary between test execution and preview; **0 HTTP E2E tests passed in this environment**. Tests and CI commands remain included for a normal local/CI environment.

Automated desktop/390px browser specs are provided in `tests/browser`; not executed here because browser automation is controlled through the cloud browser and its exposed API does not provide viewport resize. Desktop UI navigation was inspected through that browser. 390px overflow and keyboard flow remain unverified. No mobile pass claimed.

## Required hosted acceptance checklist

Use a dedicated development Supabase project and two real verified accounts:

1. Apply migration; run Supabase DB advisors and inspect grants/RLS.
2. Signup → email confirmation → login → refresh → logout; reset email → recovery callback → password update.
3. User A creates Alpha; User B creates Beta. Query the Data API with each JWT: other tenant's organizations, memberships/settings/invites/audit remain inaccessible. Direct table DML and protected RPCs must fail.
4. A invites B with editor/viewer/admin roles as permitted. Wrong email, expiry, revoke, reuse and changed inviter permissions fail. Compare organization switcher membership to database results.
5. Test two simultaneous invite accepts, revocation vs accept, seat-limit races and suspended user's concurrent mutation; PGlite's single-connection tests do not establish concurrency/load guarantees.
6. Test all forms and errors at desktop/390px with keyboard; run `pnpm test:browser` and full signed-in E2E flows. Confirm no horizontal overflow or hidden critical controls.
7. Confirm environment/origin config, cookie refresh/cache handling, email limits, CAPTCHA/perimeter throttling and nonce CSP before public exposure.

## Corrected findings

- TypeScript 7 was incompatible with typescript-eslint; pinned TS 6.0.3.
- ESLint 10 had incompatible React/import/a11y plugin peers; pinned compatible ESLint 9.39.5, which is upstream-deprecated. Follow-up maintenance gate documented.
- Fixed test fixture typing and SSR client syntax caught by build/typecheck.
- Adapted local dev launcher for supervisor host/port flags.
- Seed runner uses `node --import tsx` to avoid sandbox-blocked CLI IPC socket; no network privileges changed.

**Phase 1 release gate is not fully accepted.** No hosted Supabase project, production data, remote commits, deployment, live billing, real notification provider or workflow executor was changed or activated.

## Webhook/deadline and initial editor extension — 17 October 2026

This section supersedes earlier scope statements for the feature branch. The previous monitor commit passed GitHub Actions run [39007861188](https://github.com/BAKUGOS1/ryn/actions/runs/39007861188), including all four HTTP smoke checks that were locally network-blocked.

Current extension: **116 local tests pass across 11 files**, including 30 new graph/crypto/intake/SQL/editor-contract tests. Strict typecheck, ESLint, formatting, disposable seed and production build passed. Registry production audit after adding React Flow reports 0 advisories. This does not certify the application as vulnerability-free.

New coverage includes signature/body/ID/timestamp tampering, replay/conflict handling, encrypted secret tenant binding, key rotation fencing, normalized-field privacy, strict graphs, timezone/DST consistency, version pinning, pause/resume, one-time deadlines, superseded schedules, RLS/private-secret denial, shared quota enforcement, recipient revalidation and relay recovery. SQL executes all three actual migrations with Auth fixtures. Provider calls are deterministic adapters; no real emails were sent.

Added CI browser checks run the public local-only editor sample on desktop and 390px: keyboard opening, invalid graph recovery, typed condition editing, sample simulation, disabled saving, no API mutations and overflow. Read the draft PR's latest check/run for authoritative executed browser results. The initial run caught an ambiguous Comparison label; the control now has an explicit accessible name. A local supervised development preview rendered the new page, but its client interaction did not activate in the cloud browser, so that inspection is not counted as a successful editor test.

Hosted authentication/authoring, real Supabase PostgREST, live Inngest/Resend, multi-connection contention/load, egress restrictions and beta-user acceptance remain open. No hosted schema, deployment, live billing or real provider send was performed.

## Ryn rename verification — 2026-10-17

151 automated tests across 15 files passed, including Ryn signed-header intake and legacy-header verification. All five ordered migrations passed the disposable seed and SQL suite; future notification wording is Ryn. Lint, strict typecheck and formatting passed. The first local production build hit a stale Turbopack persistence-cache error; deleting only generated `.next` output and rebuilding passed. All 5 HTTP checks passed against that production build. Local desktop/mobile browser tests could not launch because Chromium headless-shell is absent; their 10 launch failures are infrastructure failures, not passing checks. CI browser results must be inspected separately.

Vercel project renamed in place to `ryn`; `ryn-workflows.vercel.app` assigned and verified, APP_ORIGIN updated. Exact requested `ryn.vercel.app` is owned by another team. GitHub repository rename was initially blocked by authentication; after owner sign-in, the repository was renamed in place to `BAKUGOS1/ryn`, and its description and website were updated. The original repository, history and PR are preserved. Original master plan and applied migrations remain unchanged; stable integration identifiers are documented in `BRANDING.md`. Backend, indexing and billing remain disabled.
