# Ryn deployment handoff

Current brand: **Ryn**. Assigned new public domain: https://ryn-workflows.vercel.app/. See `BRANDING.md` for rename state, compatibility identifiers and the latest verification. Older deployment receipts below retain their original source/URL evidence.

## Current state

The owner authorized a public deployment, initially deferred account/backend setup, then reconnected Vercel. The **public demo is now deployed** at https://futureflow-livid.vercel.app/.

- Vercel team: `mohitr9898-5504s-projects`; project: `prj_0ePAmcEZXzHcHTI2irN68L7IGX78`.
- Production deployment: `dpl_4iiL6Jysb5RVt9BcTwz3JExtu81g`, **READY**.
- Deployed source: `3c6d90e62195ad4b25f97686321448d6ff52ee6d`, branch `phase-2/website-monitor`; `main` remains unmerged.
- Node.js 24.x; Next.js; build approximately 74 seconds. APP_ORIGIN is the public demo origin. Worker and indexing flags are explicitly false; no Supabase/provider credentials were supplied.
- The dedicated demo project allows public access without Vercel authentication. No paid add-on, domain purchase, hosted DB migration, real notification or billing activation was performed.

Post-deployment verification: Node fetch returned 200 for home, guide, use cases, security, preview, login, robots and sitemap. Preview/auth responses carry noindex headers. robots blocks crawling, sitemap contains no indexed entries, and the unconfigured organizations API returns 503/no-store. The cloud browser opened the public URL without login, loaded the lazy editor, verified the matching sample path and then the non-matching/skipped path. Local simulation saved or sent nothing. The standalone Playwright HTTP runner could not resolve the host (EAI_AGAIN); those five remote tests are **not** claimed passed. Direct fetch and browser checks provide the live evidence.

Authentication, actual workflow execution and real email delivery remain deferred until backend setup. A hosted public demo is not production acceptance of the connected SaaS.

Last fully verified application commit: `1a6963152b8e635338f8299a5043d2649bcc6a1a`. GitHub Actions [39032630115](https://github.com/BAKUGOS1/ryn/actions/runs/39032630115) passed 150 automated tests, 5 HTTP checks and 10 public desktop/390px browser checks, plus formatting, lint, typecheck, disposable seed and production build. The deployment-config/documentation checkpoint after it does not change application behavior.

## Deploy the public demo first

1. Reconnect Vercel in ChatGPT Apps, or open your own Vercel dashboard.
2. Create/select a dedicated **Ryn** project. Import `BAKUGOS1/ryn`; use the repository root, **Next.js**, **Node.js 24.x**, and the package-manager version pinned in `package.json`. `vercel.json` supplies the frozen-lockfile install and production build commands.
3. Select **`phase-2/website-monitor`** as the source branch and inspect the commit before deploying. `main` currently contains only the older foundation. A normal import may default to `main`; change the deployment branch explicitly. No merge is needed for a branch preview.
4. Keep the following flags disabled. Leave unconfigured Supabase and worker credentials absent rather than copying placeholders from `.env.example`.

   ```dotenv
   MONITORING_ENABLED=false
   AUTOMATION_ENABLED=false
   SITE_INDEXING_ENABLED=false
   ```

5. Set `APP_ORIGIN` to the final HTTPS deployment origin and rebuild. This sets canonical/social URLs; it does not connect authentication or enable indexing. If the first deployment supplies the final hostname, configure the origin and redeploy once.
6. Verify `/`, `/docs`, `/use-cases`, `/security`, `/preview` and `/preview?tab=studio`. Open the editor, simulate critical and non-critical sample events, and check a 390px viewport. The demo must create no saved workflows, emails or external actions. `/auth/login` should honestly show that authentication is not connected.
7. Check that robots.txt blocks pre-release indexing, private/demo responses retain `X-Robots-Tag: noindex, nofollow`, and the share image loads. If a preview requires Vercel sign-in, it is a protected preview, not a public link; choose the project's intended public access settings before sharing.

This produces a hosted public demo, not connected SaaS operations. Record the actual deployment URL, environment, commit, READY status and post-deploy checks. Do not claim a URL is live until it responds successfully.

## Connect the backend later

Use a dedicated approved Supabase project. Apply all ordered migrations once, including `20261017122144_workflow_delivery_evidence.sql`. Keep `private` outside exposed Data API schemas, enable confirmed-email Auth, configure the deployed origin/callbacks, and use two verified test accounts. Supply the project's public URL and publishable key via hosting environment settings; keep the server secret server-only. Never paste secrets into GitHub, chat or this file.

Run hosted advisors, JWT/PostgREST tenant isolation and the signed-in create/save/publish/pause journey. Real execution additionally needs the Inngest credentials, webhook encryption keyring, Resend sender and controlled inbox, owned target hosts and egress review described in `CORE_WORKFLOW_AUDIT.md`. Enable workers and real sends only after that setup and approval. Billing remains deferred.

A future public product launch also requires the remaining load/concurrency, backup/restore and operational acceptance gates. Search indexing should be enabled only on the approved production origin after those launch decisions.
