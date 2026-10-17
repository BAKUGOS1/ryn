# Security model and remaining gates

## Implemented

- Fresh `getUser` identity for server authorization, confirmed email requirement and anonymous-user rejection. Session cookies alone are not trusted.
- Exact Origin checks on application mutation routes; 8 KiB streamed JSON limit; strict schemas; safe errors.
- Membership checks on server and within DB writes; RLS, composite FK and restricted columns; no service-role app credential.
- 32-byte random invitation token, SHA-256 at rest, URL fragment avoids request/referrer token exposure; email from confirmed auth.users, seven-day expiry, revoke and row-locked single use.
- Owner immutable through membership API; admin cannot grant/manage admin or owner; no invite-based reactivation or silent role update.
- Archive retains data; audit rows contain only action/resource/user IDs, no secret payloads.
- 30 successful DB mutations per user/minute; 5 owned active organizations; 20 pending invitations and active seats per organization. Limits rechecked inside transactions.
- Basic CSP, framing prohibition, nosniff, no-referrer, sensitive no-store responses. Server errors do not expose database details.

## Known limitations / launch gates

1. Hosted Auth, PostgREST and real DB-role behavior must be exercised with two accounts. PGlite uses real PostgreSQL policies but fixture auth functions/users. Multi-connection contention/deadlock/load verification not performed.
2. Invalid operations roll back DB bucket increments too. Edge rate limiting and Supabase auth CAPTCHA/IP limits must cover failed requests and unauthenticated abuse before public launch. DB throttle is not a perimeter DDoS defense.
3. CSP currently permits inline scripts/styles for Next rendering. Add nonce-based CSP and test compatibility before public release. HSTS is a deployment-level gate; custom Supabase domains need CSP configuration.
4. Supabase SSR default cookies support browser clients and are not an HttpOnly-only session architecture. Use XSS defenses; no arbitrary HTML. Account/session revocation behavior and password-reset completion need live verification.
5. No monitoring, secrets store, external email actions or webhook intake exists yet. SSRF, signed replay-protected webhooks, encryption keys and effect idempotency are Phase 2 requirements, not tested controls in this slice.
6. Backup/restore, privacy, retention, merchant/tax eligibility and security advisor checks against hosted Supabase remain open. No compliance claims.
7. Development lint dependencies require a coordinated supported-version upgrade; see README.

On the Phase 2 branch, `PHASE_2_DELIVERY.md` supersedes the earlier statement that no monitoring implementation exists. It documents the guarded worker adapter, SSRF defenses, idempotent incident/delivery logic and unverified hosted gates. Service-role access is server-only, uses reviewed tenant-explicit RPCs, and remains disabled until configured.
