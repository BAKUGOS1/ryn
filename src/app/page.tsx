export const dynamic = "force-dynamic";
import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Users, Layers3 } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { readEnv } from "@/lib/env";
export default function Home() {
  const configured = !!readEnv();
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <Link href="/auth/login">
          Sign in <ArrowUpRight size={15} />
        </Link>
      </header>
      <main id="main" className="landing-main">
        <span className="eyebrow">
          <span className="dot" /> RELIABLE BY DESIGN
        </span>
        <h1>
          Less watching.
          <br />
          More <em>moving forward.</em>
        </h1>
        <p className="lede">
          A clear home for your team and the events that matter. Build the
          foundation for automation you can trust.
        </p>
        <div className="actions">
          <Button asChild>
            <Link href="/auth/signup">
              Create your workspace <ArrowUpRight size={17} />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/preview">Explore the workspace</Link>
          </Button>
        </div>
        <p className="quiet">
          Phase 1 foundation · No payment details required
        </p>
        <div className="feature-grid">
          {[
            [
              ShieldCheck,
              "Your workspace. Your boundary.",
              "Organization-scoped access and verified identities.",
            ],
            [
              Users,
              "The right people, the right access.",
              "Four clear roles and email-bound invitations.",
            ],
            [
              Layers3,
              "Start small. Build reliably.",
              "A focused foundation for your next automation.",
            ],
          ].map(([Icon, title, description]) => {
            const I = Icon as typeof ShieldCheck;
            return (
              <section className="feature" key={String(title)}>
                <I size={25} />
                <h2>{String(title)}</h2>
                <p>{String(description)}</p>
              </section>
            );
          })}
        </div>
        {!configured && (
          <aside className="setup-note">
            <strong>Development setup required</strong>
            <p>
              Authentication is not connected yet. Add the Supabase URL,
              publishable key and application origin from the README to enable
              sign-in. You can explore the read-only workspace preview now.
            </p>
          </aside>
        )}
      </main>
      <footer>
        FUTUREFLOW <span>Detect → Evaluate → Decide → Execute → Verify</span>
      </footer>
    </div>
  );
}
