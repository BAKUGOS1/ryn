# Product and search optimization — 17 October 2026

This pass improves the existing app; it does not certify full launch readiness. Billing and AI remain deferred. No deployment, hosted migration, real notification or payment was activated.

## Changes

- Replaced outdated foundation-only landing copy with the three implemented workflows, a sample-first CTA, visible answers and explicit development status. Added concise use-case, getting-started and security pages with shared navigation.
- Public pages prerender as static HTML. The React Flow editor remains lazy-loaded only when opened. Pending invitations are fetched only on the members route rather than on every workspace page.
- Added page-specific titles/descriptions, canonical URLs from validated APP_ORIGIN, Open Graph/Twitter metadata, a generated PNG share image, safe SoftwareApplication JSON-LD, robots.txt and a public-only sitemap. No invented ratings, prices, certification, testimonials or ranking guarantees.
- Public indexing requires SITE_INDEXING_ENABLED=true and a valid HTTPS APP_ORIGIN at build time; Vercel preview deployments remain excluded. Defaults are deliberately non-indexable before approved launch. Auth, workspace, invite, API and demo paths retain noindex headers; authorization remains the actual data boundary.
- Overview now leads to workflow creation. The website-monitor card links to Monitors rather than the webhook/deadline editor.
- Collapsing the visual editor retains its in-memory edits. Refresh/new-document navigation and ordinary links warn about unsaved edits. This is not durable draft autosave, and same-document browser Back/Forward is not intercepted. Canvas positions are explicitly labeled as unsaved.
- Invalid JSON values remain associated with their step across selection changes, preventing validation bypass. Simulation results are invalidated by definition changes. Save requests have an immediate in-flight lock and optimistic revision handling; a refresh no longer remounts the editor on every revision.

## Evidence and limits

Local: 127 tests in 12 Vitest files pass; lint and strict typecheck pass; production build succeeds and confirms static public pages. HTTP and browser evidence is recorded in CI/PR after execution. New regressions cover launch gating, canonical/sitemap allowlists, JSON-LD escaping, noindex response headers, public navigation, collapsed-edit preservation, stale simulation and invalid input across step selection.

A local Chromium download returned an invalid/truncated archive; browser tests are therefore run through GitHub Actions, not represented as locally passed. No Core Web Vitals or ranking score is claimed. Missing APP_ORIGIN in an unconfigured build causes Next.js to use localhost for automatic social-image URLs; an approved launch must set APP_ORIGIN and rebuild.

Remaining release work: approved dedicated hosted Supabase/Auth, signed-in authoring and provider delivery checks, network egress validation, PostgreSQL contention/load, independent accessibility/security review and backup/restore drills. Published security content states these limits.

## Launch verification

Set the final approved HTTPS APP_ORIGIN and enable SITE_INDEXING_ENABLED only for production, then rebuild. Check rendered canonical/robots/OG tags, all four sitemap URLs and private noindex responses. Verify domain ownership in Search Console, submit the sitemap and use URL Inspection. Measure actual mobile field performance and activation after traffic exists. Indexing or inclusion in AI answers cannot be guaranteed.

Official guidance reviewed:

- https://developers.google.com/search/docs/appearance/ai-features — ordinary SEO fundamentals, accessible text, internal links and structured data matching visible content; no special AI schema/text file required.
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots — App Router robots metadata convention.
