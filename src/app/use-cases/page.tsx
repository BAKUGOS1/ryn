import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { publicMetadata } from "@/lib/seo";
export const metadata = publicMetadata(
  "/use-cases",
  "Three signals. Clear next steps. | Ryn",
  "Website alerts, signed webhook routing and one-time deadline reminders for small teams.",
);
const sections = [
  [
    "Website down alert",
    "Configure an allowed public HTTPS endpoint. Two consecutive failed probes open one incident and queue an email notification. A successful recovery resolves the incident. Inspect probe evidence instead of relying on a status badge alone.",
  ],
  [
    "Critical event routing",
    "Receive an authenticated webhook, compare a field such as priority with \u201ccritical\u201d, then reach an email or audit action. Each accepted event is tied to a published workflow version. Duplicate event deliveries are deduplicated.",
  ],
  [
    "Upcoming deadline",
    "Set a deadline with an explicit UTC offset, timezone and lead time. The scheduler admits one reminder per configured occurrence. This is a one-time reminder, not a recurring calendar or subscription service.",
  ],
  [
    "A deliberate scope",
    "Ryn focuses on these three triggers, typed conditions and bounded actions. It does not run arbitrary scripts or offer hundreds of connectors. Live use requires connected and verified providers; the public demo is local simulation.",
  ],
];
export default function Page() {
  return (
    <PublicShell>
      <article className="public-article">
        <span className="eyebrow">RYN · USE-CASES</span>
        <h1>Three signals. Clear next steps.</h1>
        <p className="lede">
          Website alerts, signed webhook routing and one-time deadline reminders
          for small teams.
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
