# Security reference notes

Supabase SSR docs: https://supabase.com/docs/guides/auth/server-side/creating-a-client
RLS docs: https://supabase.com/docs/guides/database/postgres/row-level-security

Cookie session is not identity: verify server-side via getUser. Membership is live database state, never editable user_metadata. Tenant reads use RLS; writes call security-invoker public wrappers around tightly scoped private functions with explicit verified-user and role checks, fixed search_path and revoked PUBLIC execution. No service key used by application.

Invitation tokens: 256 random bits, SHA-256 at rest, email bound to confirmed auth.users record, expiration, revocation, row-lock single use. Invite acceptance must not reactivate suspended members or change existing roles. Rate limits and seat limits apply transactionally.

Phase 2 required defenses: restricted outbound egress, DNS revalidation on every connection/redirect, IPv4/v6 private range blocking, response bounds; timestamped raw-body HMAC and replay protection. Neither monitoring nor webhook intake exists in Phase 1, so no claimed SSRF/webhook protection yet.
