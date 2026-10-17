# Validation evidence — 17 October 2026 (Asia/Kolkata)

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
