import Link from "next/link";
import { Activity, Webhook, CalendarClock, ArrowUpRight } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import {
  publicMetadata,
  siteConfig,
  siteDescription,
  serializeJsonLd,
} from "@/lib/seo";
export const metadata = publicMetadata(
  "/",
  "Website monitoring & event automation | FutureFlow",
  siteDescription,
);
const questions = [
  ["What is FutureFlow?", siteDescription],
  [
    "Which workflows can I build?",
    "Start with website incident alerts, signed webhook conditions or one-time deadline reminders. The visual editor supports webhook and deadline workflows; website monitors use a focused setup form.",
  ],
  [
    "Will trying the demo send emails?",
    "No. The public demo uses sample data and local simulation. It does not save workflows, send messages or connect to your services.",
  ],
  [
    "Is FutureFlow ready for live operations?",
    "FutureFlow is in development. Connected authentication, background jobs and email delivery require setup and end-to-end verification before live use. Paid plans are not available yet.",
  ],
];
export default function Home() {
  const { origin } = siteConfig();
  return (
    <PublicShell>
      {origin && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "FutureFlow",
              url: origin,
              description: siteDescription,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              featureList: [
                "Website monitoring",
                "Signed webhook workflows",
                "Deadline reminders",
                "Workflow simulation",
              ],
            }),
          }}
        />
      )}
      <span className="eyebrow">
        <span className="dot" /> WEBSITE MONITORING & EVENT AUTOMATION
      </span>
      <h1>
        Less watching.
        <br />
        More <em>moving forward.</em>
      </h1>
      <p className="lede">
        Monitor your website, respond to important events and stay ahead of
        deadlines. One focused workspace, with a clear record of what happened
        and why.
      </p>
      <div className="actions">
        <Button asChild>
          <Link href="/preview?tab=studio">
            Try a sample workflow <ArrowUpRight size={17} />
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/docs">See how it works</Link>
        </Button>
      </div>
      <p className="quiet">
        Development preview · No account needed for the demo · No live actions
      </p>
      <div className="feature-grid">
        {[
          {
            Icon: Activity,
            title: "Know when your site needs you",
            text: "Two consecutive failed checks open an incident. Recovery closes it, with probe evidence attached.",
          },
          {
            Icon: Webhook,
            title: "Give important events a next step",
            text: "Evaluate signed webhook fields and route matching events to a team notification or audit record.",
          },
          {
            Icon: CalendarClock,
            title: "Keep a deadline in view",
            text: "Schedule a one-time reminder with an explicit timezone and a verified team recipient.",
          },
        ].map(({ Icon, title, text }) => (
          <section className="feature" key={title}>
            <Icon size={25} aria-hidden="true" />
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
      </div>
      <section className="public-section">
        <h2>Choose a signal. Test the path. Review the result.</h2>
        <p>
          Start with one useful workflow. Configure the trigger, add a condition
          if needed, then simulate before saving and publishing. Review run
          history to see which steps executed.
        </p>
        <Link className="text-link" href="/use-cases">
          Explore the three starting points →
        </Link>
      </section>
      <section className="public-section faq">
        <h2>A few clear answers</h2>
        {questions.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </PublicShell>
  );
}
