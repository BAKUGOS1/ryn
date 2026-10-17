# Core workflow audit and corrections

Date: 17 October 2026. Starting branch head: `d6d15d973f13b28b37173a9d0903bf363a0d698a`; remote inspection found no newer changes. Continue on `phase-2/website-monitor`, draft PR #1.

The existing Next.js/Supabase modular monolith and shared workflow compiler are retained. Billing and AI remain deferred. No production deployment, hosted migration, real notification or payment was performed.

## Findings and corrections

| Priority | Concrete defect                                                                                                                         | Correction                                                                                                                        | Evidence                                                                                             |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| High     | Quota exhaustion marked a workflow run skipped but left its reached notification step queued                                            | Normalize reached notification steps when the run becomes terminal                                                                | Actual SQL integration regression failed before the migration, passes afterward                      |
| High     | Delivery retry/window and outbox recovery could leave parent workflow/monitor evidence stale until a subsequent scheduler tick          | Delivery terminal transitions synchronize parent states and traces in the same transaction                                        | SQL retry-exhaustion regression; existing full lifecycle/provider-adapter suites                     |
| High     | A delivery outside its retry/idempotency window could be classified as skipped when the recipient had since changed, hiding uncertainty | Classify exhausted/expired attempts as requires_review before recipient eligibility                                               | SQL regression reproduced skipped vs requires_review before the fix; no provider call occurs         |
| Medium   | Publish/pause advance the saved revision while an open editor keeps its original revision                                               | Rebase revision-only changes when the saved definition is unchanged; block different saved definitions and expose explicit reload | Revision lifecycle tests plus actual SQL stale-save/publish rejection and viewer denial              |
| Medium   | Shared forms could submit twice before React disabled the button; HTML/network errors produced unhelpful parser exceptions              | Immediate submission lock, disabled fieldset during submission, safe actionable response errors and no automatic mutation retry   | Client request tests and production type/lint/build; hosted form interaction remains a separate gate |
| Medium   | Delivery notes contradicted the latest browser and collapse behavior                                                                    | Updated handoff, roadmap and validation chronology                                                                                | Current docs and PR checks                                                                           |

The migration is `supabase/migrations/20261017122144_workflow_delivery_evidence.sql`, created with the Supabase CLI. It adds two internal trigger functions, replaces the guarded delivery-claim implementation and reconciles historical terminal traces. Published definitions remain immutable. Trigger/helper execute privileges are revoked from PUBLIC, anon and authenticated; existing protected RPC permissions and tenant keys remain in force. The SQL suites execute all four migrations in disposable PGlite only.

## Journey audit

- **Onboarding/auth:** server `getUser` verifies identities; unconfirmed and anonymous identities fail closed. Auth callbacks restrict destinations to the app or password-update page. Actual hosted email confirmation/reset/session-cookie behavior remains unverified.
- **Create/save:** strict shared schema and organization authorization precede authoring RPCs. Viewers/non-members cannot write; editors cannot create webhook sources. Stale revisions conflict. Drafts remain available with execution disabled.
- **Publish/resume:** application routes reject missing worker/provider configuration; SQL revalidates recipient, definition, revision and future deadline. Pause remains available even if execution configuration is disabled.
- **Execute:** existing SQL/provider-adapter suites cover event deduplication/conflict, pinned versions, pause fencing, quota admission, one-time deadlines and notification idempotency. These are local adapters, not live provider acceptance.
- **Inspect:** terminal steps now follow the delivery outcome, including recovery/exhaustion. A skipped, unreached email branch remains skipped when another branch records an audit.
- **Mobile:** public editor/navigation regression tests run on desktop and 390px in CI. Real authenticated authoring still requires the dedicated environment below.

## Required external inputs and operational gates

A dedicated approved development Supabase project is not configured for this checkout. No unrelated connected project was used. Required: project URL/publishable key and server secret through protected environment configuration, approved migration application, confirmed-email Auth and two verified test accounts. Then test actual JWT/PostgREST tenant boundaries, cookie refresh, invitations and signed-in authoring on desktop/mobile; run hosted DB advisors.

Execution additionally needs approved Inngest signing/event configuration, Resend verified sender and a controlled recipient inbox, webhook encryption keyring, an owned HTTPS target and reviewed egress restrictions. Real sends and execution remain disabled pending that setup/approval. PGlite is single-connection evidence; PostgreSQL contention, load and backup/restore drills are still required.

Durable editor autosave, canvas-position storage and same-document Back/Forward protection remain follow-ups. No feature is labeled connected or production-ready solely because its adapter tests pass.

Reference checked: https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs. The markdown changelog endpoint was inaccessible through the web reader; the HTML changelog and SSR guide were accessible. No new Supabase SDK convention or dependency upgrade was introduced.
