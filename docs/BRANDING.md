# Ryn naming and compatibility

The owner selected **Ryn** on 2026-10-17. The public app, page titles, accessible labels, Open Graph image, structured data, package name, CI name and maintained product docs use Ryn.

- Vercel project: `ryn`, existing ID `prj_0ePAmcEZXzHcHTI2irN68L7IGX78` (same project, no replacement).
- Assigned and verified production domain: `ryn-workflows.vercel.app`.
- `ryn.vercel.app` and `ryn-app.vercel.app` were rejected by Vercel with `owned-on-other-team`; a public 404 did not establish availability.
- GitHub repository renamed in place to `BAKUGOS1/ryn`, verified in the signed-in settings flow. Repository description and website updated; PR #1 and its feature branch are retained.
- Keep the original supplied `FUTUREFLOW_FINAL_MASTER.md` verbatim as historical product requirements. This naming decision supersedes its product name only.

## Stable integration identifiers

The legacy AES-GCM associated-data prefix, Inngest app/event identifiers and email idempotency-key prefix intentionally retain their original values. Changing these for display branding would break stored secrets, queued work or duplicate suppression. These are internal compatibility identifiers, not public branding.

New webhook senders use `X-Ryn-*`; complete `X-FutureFlow-*` headers remain supported. Never mix partial families. Durable intake uses the same selected event ID that was authenticated. A new additive SQL migration changes only future notification wording; applied migration files, existing delivery records and immutable published versions stay untouched. Apply to a dedicated development database before any owner-approved hosted migration.

No real notifications, billing, hosted migrations or backend activation are part of the rename. Indexing stays disabled. Deployment and test evidence will be recorded after verification.

## Ryn rename verification — 2026-10-17

151 automated tests across 15 files passed, including Ryn signed-header intake and legacy-header verification. All five ordered migrations passed the disposable seed and SQL suite; future notification wording is Ryn. Lint, strict typecheck and formatting passed. The first local production build hit a stale Turbopack persistence-cache error; deleting only generated `.next` output and rebuilding passed. All 5 HTTP checks passed against that production build. Local desktop/mobile browser tests could not launch because Chromium headless-shell is absent; their 10 launch failures are infrastructure failures, not passing checks. CI browser results must be inspected separately.

Vercel project renamed in place to `ryn`; `ryn-workflows.vercel.app` assigned and verified, APP_ORIGIN updated. Exact requested `ryn.vercel.app` is owned by another team. GitHub repository rename was initially blocked by authentication; after owner sign-in, the repository was renamed in place to `BAKUGOS1/ryn`, and its description and website were updated. The original repository, history and PR are preserved. Original master plan and applied migrations remain unchanged; stable integration identifiers are documented in `BRANDING.md`. Backend, indexing and billing remain disabled.
