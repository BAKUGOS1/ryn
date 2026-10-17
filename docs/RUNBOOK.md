# Foundation runbook

**Auth unavailable:** confirm the three environment values without printing secrets; verify exact APP_ORIGIN and callback allowlist, email confirmation and provider status. Never enable a fake login to bypass failure.

**Tenant access denied:** inspect the current member status and organization archived_at as an authorized operator. Reproduce with the affected JWT through the Data API; do not solve by adding service-role access to the browser or broadening RLS.

**Invitation failed:** check confirmed recipient email, expiry, revocation, accepted_at and inviter's current role. Generate a new invitation after revoking/expiring the old one. Never retrieve plaintext tokens from logs; hashes cannot reconstruct them.

**Accidental archive:** approved operator may restore archived_at in a development environment; invite revocations stay revoked. Production restore needs explicit approval and an audit event. No automatic destructive cleanup.

**Migration failure:** transaction rolls back; inspect the SQL error in a dedicated development project. Do not retry against production or drop existing tables. Validate with local test suite before changes.

**Suspected isolation breach:** restrict application access through the approved deployment process; preserve minimized audit evidence; rotate compromised credentials, reproduce under separate tenant identities, patch and rerun tests. Do not dump private data to support logs.

Phase 2–4 runbooks for outbox backlog, executor outages, duplicate notifications and payment reconciliation must be implemented with those services.
