import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { publicMetadata } from "@/lib/seo";
export const metadata = publicMetadata(
  "/docs",
  "Get started with Ryn | Ryn",
  "A short guide to choosing, testing and reviewing your first automation.",
);
const sections = [
  [
    "1. Explore before connecting",
    "Open the sample editor, expand \u201cTest safely with a sample event\u201d and simulate the default critical-priority event. Change priority to \u201clow\u201d to see a different path. The demo never sends email or saves data.",
  ],
  [
    "2. Create a workspace",
    "When authentication is connected, sign up, verify your email and create a workspace. Owners and admins manage membership; editors can author workflows; viewers inspect results. Invite only the people who need access.",
  ],
  [
    "3. Choose one workflow",
    "Use Monitors for a website down alert. Use Automations for a signed webhook or deadline reminder. Choose an active, verified team recipient for notifications. Begin with one condition and one action.",
  ],
  [
    "4. Test, save and publish",
    "For webhook and deadline workflows, use the visual editor to check conditions with sample JSON. Simulation does not contact providers. Save the draft, review it, then publish from its workflow card. Publishing creates an immutable version. Connected workers and providers are required for actual execution.",
  ],
  [
    "5. Review and pause",
    "Inspect the workflow\u2019s run history and step timeline. Check delivery status separately from a matched condition. Pause a workflow to stop future admissions; work already admitted may still finish.",
  ],
  [
    "If something is unavailable",
    "Sign-in unavailable: authentication setup is incomplete. Nothing runs: confirm the workflow is published, execution is enabled and usage is below its cap. Email pending or failed: inspect the delivery evidence and provider configuration. A successful simulation is not proof of live delivery.",
  ],
];
export default function Page() {
  return (
    <PublicShell>
      <article className="public-article">
        <span className="eyebrow">RYN · DOCS</span>
        <h1>Get started with Ryn</h1>
        <p className="lede">
          A short guide to choosing, testing and reviewing your first
          automation.
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
