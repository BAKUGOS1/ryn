# Phase 1 implementation plan

Estimate before implementation: 4–8 engineering days plus 1–2 days hosted validation (uncertain; account access can extend this).

1. Pin Next/React/Supabase/Zod/Tailwind and tools, strict TS, pnpm lock, lint/format/build CI.
2. SSR auth signup/login/logout/reset/confirmation; validate environment; fail closed without config.
3. SQL organization/membership/settings/invite/audit model, private guarded functions, explicit grants and RLS; soft archive rather than destructive deletion.
4. APIs validate input, same-origin mutations, fresh identity and tenant membership. Database rechecks writes.
5. Original responsive shell, workspace switcher, onboarding, members, settings, invite acceptance. No service-role key, external invites or billing.
6. Unit validation/RBAC tests; real Postgres-engine SQL tests for two tenants and invitation replay/expiry/role escalation; route tests; build; browser smoke. Hosted Supabase signup/reset/session refresh and full signed-in browser journey remain a separate credential-dependent gate.

Acceptance requires no cross-tenant reads or writes, no unauthorized role changes, immutable owner role, no raw token reads, bounded mutation rates, atomic acceptance, and passing tooling. Report any unrun gate, never treat mocked auth as hosted verification.
