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

## CI confirmation for Ryn

GitHub Actions run [39045565367](https://github.com/BAKUGOS1/ryn/actions/runs/39045565367) completed successfully on source `a3790131d08918bba3ae6ba6159353d7b6326413`. Job logs confirm 151 tests across 15 files, 5 HTTP checks and all 10 desktop/390px browser checks passed, plus formatting, lint, typecheck, disposable five-migration seed and production build. This resolves the local missing-Chromium browser-verification gap for the tested source.

## Live Ryn deployment receipt

- Public URL: https://ryn-workflows.vercel.app/
- Same Vercel project ID, now named `ryn`; repository https://github.com/BAKUGOS1/ryn; draft PR https://github.com/BAKUGOS1/ryn/pull/1 remains unmerged.
- Production deployment `dpl_7C8Q6hpFso8U4cFf9Pz76pjHgxva`: **READY**, no alias error, source `a3790131d08918bba3ae6ba6159353d7b6326413`. Build approximately 29 seconds. Both the new public URL and the existing `futureflow-livid.vercel.app` alias point at this build.
- Live direct fetch: eight public/setup/SEO routes returned 200 with Ryn titles and new canonical URLs where applicable; no former product name appeared in their responses. Preview/auth remain noindex. Robots still disallows crawling and sitemap has no indexed entries. Unconfigured organizations API returns 503.
- Cloud browser opened the public Ryn homepage and navigated to the sample studio on the new domain. This is public demo verification, not hosted authentication or live automation acceptance.
- Runtime error-log/drain acceptance was not performed. No hosted migrations, real notification, paid feature, billing or indexing activation. Source commit differs from later documentation-only receipt commits.
