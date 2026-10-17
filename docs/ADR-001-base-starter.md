# ADR 001: official Supabase starter foundation

Accepted for Phase 1. Use the official with-supabase SSR integration as the one base, with original application and SQL. Retain MIT notices. Do not merge starter repositories.

Makerkit Lite offers useful pnpm boundaries and Playwright setup but imports many kit packages and its reviewed migration focuses on accounts. Team RBAC still needs original work. Next.js SaaS Starter uses custom JWT/password storage, Stripe and canary Next 15; reject as base.

Use one Next.js app with feature modules, pnpm and reviewed SQL migrations. Defer Turborepo and empty packages until a second application/worker package justifies them. Supabase Data API under the user's JWT preserves RLS; do not add a second direct database access path or Drizzle just for Phase 1. SQL is the migration source of truth. Pin current stable packages and lockfile, verify actual build. This intentionally simplifies the illustrative monorepo layout.
