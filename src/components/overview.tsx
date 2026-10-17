import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  ShieldCheck,
  Users,
  GitBranch,
  ArrowRight,
} from "lucide-react";
export function Overview({
  name,
  members,
  role,
  orgId,
  preview = false,
}: {
  name: string;
  members: number;
  role: string;
  orgId: string;
  preview?: boolean;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</span>
          <h1>Your workspace, in focus.</h1>
          <p className="muted">
            Welcome to {name}. Let’s put the right foundation in place.
          </p>
        </div>
        <Link
          className="text-link"
          href={preview ? "/auth/signup" : `/app/${orgId}/members`}
        >
          {preview ? "Make it yours" : "Manage your team"}{" "}
          <ArrowUpRight size={17} />
        </Link>
      </div>
      {preview && (
        <p className="preview-notice">
          Design preview · Sample workspace. No live data or connected services.
        </p>
      )}
      <section className="welcome-panel">
        <div>
          <span className="welcome-tag">
            <span className="dot" /> START WITH CONFIDENCE
          </span>
          <h2>
            Good automation starts
            <br />
            with a great workspace.
          </h2>
          <p>
            Bring your people together. Give everyone the right access.
            <br className="desktop-only" /> Then build something that keeps
            moving.
          </p>
          <Link
            href={preview ? "/auth/signup" : `/app/${orgId}/members`}
            className="button button-lime"
          >
            {preview ? "Create a workspace" : "Invite your team"}{" "}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        <div
          className="flow-illustration"
          aria-label="Organize, connect, automate"
        >
          <div>
            <Users size={23} />
            <span>Your team</span>
            <Check size={14} />
          </div>
          <span className="flow-stem" />
          <div className="highlight">
            <ShieldCheck size={23} />
            <span>Secure workspace</span>
            <Check size={14} />
          </div>
          <span className="flow-stem" />
          <div className="future">
            <GitBranch size={23} />
            <span>Reliable automation</span>
            <span className="tiny">NEXT</span>
          </div>
        </div>
      </section>
      <section className="stat-grid" aria-label="Workspace summary">
        <div>
          <span>Workspace members</span>
          <strong>{members.toString().padStart(2, "0")}</strong>
          <small>People with active access</small>
        </div>
        <div>
          <span>Your role</span>
          <strong className="role-value">{role}</strong>
          <small>Permissions checked for each action</small>
        </div>
        <div>
          <span>Workspace stage</span>
          <strong className="role-value">Foundation</strong>
          <small>Automation arrives in Phase 2</small>
        </div>
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>A thoughtful start</h2>
            <span className="tag">GETTING STARTED</span>
          </div>
          <div className="checklist">
            <div>
              <span className="step complete">
                <Check size={16} />
              </span>
              <span>
                <strong>Create your workspace</strong>
                <p>A dedicated home for your team.</p>
              </span>
              <span className="tag green">Ready</span>
            </div>
            <div>
              <span className="step">02</span>
              <span>
                <strong>Bring the right people in</strong>
                <p>Assign owners, admins, editors and viewers.</p>
              </span>
              <Link
                aria-label="Manage members"
                href={preview ? "/auth/signup" : `/app/${orgId}/members`}
              >
                <ArrowRight size={19} />
              </Link>
            </div>
            <div>
              <span className="step">03</span>
              <span>
                <strong>Make it feel like yours</strong>
                <p>Set your workspace name and timezone.</p>
              </span>
              <Link
                aria-label="Workspace settings"
                href={preview ? "/auth/signup" : `/app/${orgId}/settings`}
              >
                <ArrowRight size={19} />
              </Link>
            </div>
          </div>
        </section>
        <section className="panel next-panel">
          <span className="eyebrow">WEBSITE MONITORING</span>
          <GitBranch size={27} />
          <h2>From signal to action.</h2>
          <p>
            Website monitoring, incident tracking and email alerts — with the
            evidence behind every run.
          </p>
          <span className="tag">Connect a monitor in the Monitors tab</span>
        </section>
      </div>
    </>
  );
}
