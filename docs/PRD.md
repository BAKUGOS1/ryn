# Product requirements — implemented slice

Ryn: Detect → Evaluate → Decide → Execute → Verify. Initial users: developers, agencies and small SaaS teams. The final master plan is the complete product brief.

Phase 1 delivers identity, tenant boundaries and a usable team workspace. A verified user creates an organization, can switch organizations, administer permitted roles, share a single-use invitation and edit settings. Members cannot see other tenants. Owner cannot be demoted or suspended through app operations. Archive is logical deletion, not physical purge.

P0 for this slice: auth routes, current-role authorization, DB isolation, guarded writes, visible errors, CI and accessible dashboard. Actual automation, usage metrics, paid plans and real provider execution are not represented as working. Read-only preview data is labeled.

Acceptance pending: hosted Supabase end-to-end signup/reset and two-user journey; 390px interactive verification and production deployment/security review. Local SQL and code test results are recorded separately.
