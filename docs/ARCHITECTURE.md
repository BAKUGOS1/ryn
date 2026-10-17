# Architecture

One modular Next.js application, pnpm, strict TypeScript, Tailwind and an adapted shadcn Button. Server Components load tenant data, small Client Components handle forms. Independent reads are concurrent. No cross-request Supabase singleton; every request gets its own cookie client.

Mutation path: JSON input and byte bound → exact Origin check → fresh Supabase getUser → membership/RBAC read → public invoker RPC → private function → locked organization / invitation → repeated database role and state check → transaction write + audit. No service-role key. Direct Data API reads are RLS filtered; direct table writes denied.

Database is the authority for memberships, roles and lifecycle. Browser-hidden controls are UX only. URL organization IDs and client-supplied roles are requests, never proof. Mutations run under the user's JWT. Environment errors fail closed. SSR session refresh proxy preserves cookies and no-store response headers.

Future: Postgres schedules/outbox → Inngest executor → constrained action registry. This is an architecture decision, not an existing execution pipeline. Add separate packages only when a second deployable worker needs them. SQL migration discipline avoids adding an ORM for a second write path in Phase 1.
