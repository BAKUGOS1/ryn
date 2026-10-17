import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { publicMetadata } from "@/lib/seo";
export const metadata = publicMetadata(
  "/security",
  "Security, with clear boundaries. | Ryn",
  "How Ryn separates workspaces, verifies events and limits automation side effects.",
);
const sections = [
  [
    "Workspace access",
    "Organization membership and role checks protect server operations. PostgreSQL row-level security and tenant-scoped relationships provide additional isolation. Owners, admins, editors and viewers have distinct permissions.",
  ],
  [
    "Verified events and bounded actions",
    "Signed webhooks use timestamped HMAC verification and event deduplication. Monitor targets are checked against network restrictions. Workflows use a constrained schema instead of arbitrary scripts. Notifications are limited to eligible team recipients.",
  ],
  [
    "Traceable execution",
    "Published versions are immutable. Runs record step outcomes, while delivery records track provider effects. Retries are bounded and use idempotency where supported. External delivery is not advertised as universally exactly once.",
  ],
  [
    "Development status",
    "These are implemented design controls, not a security certification or service-level guarantee. Hosted integration testing, operational drills and independent review remain release gates. Do not use the development preview for sensitive production workloads.",
  ],
  [
    "Report a concern",
    "The source repository is BAKUGOS1/ryn on GitHub. Use its private vulnerability reporting option if available. Do not post secrets, personal data or exploitable details in a public issue. A dedicated security contact must be established before launch.",
  ],
];
export default function Page() {
  return (
    <PublicShell>
      <article className="public-article">
        <span className="eyebrow">RYN · SECURITY</span>
        <h1>Security, with clear boundaries.</h1>
        <p className="lede">
          How Ryn separates workspaces, verifies events and limits automation
          side effects.
        </p>
        {sections.map(([heading, body]) => (
          <section className="public-section" key={heading}>
            <h2>{heading}</h2>
            <p>{body}</p>
          </section>
        ))}
        <div className="actions">
          <Link className="button button-primary" href="/preview?tab=studio">
            Try the sample editor →
          </Link>
          <Link className="button button-secondary" href="/auth/signup">
            Create an account
          </Link>
        </div>
      </article>
    </PublicShell>
  );
}
