import Link from "next/link";
import {
  Zap,
  Activity,
  LayoutDashboard,
  Users,
  Settings2,
  ArrowUpRight,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { Brand } from "./brand";
import { Logout } from "./forms";
import type { Organization } from "@/features/organizations/model";
export function WorkspaceShell({
  children,
  org,
  organizations,
  section = "overview",
  preview = false,
}: {
  children: React.ReactNode;
  org: Pick<Organization, "id" | "name">;
  organizations: Pick<Organization, "id" | "name">[];
  section?: string;
  preview?: boolean;
}) {
  const base = preview ? "/preview" : "/app/" + org.id;
  return (
    <div className="workspace">
      <aside className="sidebar">
        <Link href="/">
          <Brand />
        </Link>
        <details className="workspace-switch">
          <summary>
            <span className="workspace-avatar">{org.name.charAt(0)}</span>
            <span>
              {org.name}
              <small>Team workspace</small>
            </span>
            <ChevronDown size={16} />
          </summary>
          <div>
            {organizations.map((o) => (
              <Link
                href={preview ? "/preview" : "/app/" + o.id + "/overview"}
                key={o.id}
              >
                {o.name}
              </Link>
            ))}
            <Link href={preview ? "/auth/signup" : "/app?new=1"}>
              + Create workspace
            </Link>
          </div>
        </details>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Workspace navigation">
          {[
            [LayoutDashboard, "overview", "Overview"],
            ...(!preview
              ? [
                  [Activity, "monitors", "Monitors"],
                  [Zap, "automations", "Automations"],
                ]
              : [[Zap, "studio", "Editor preview"]]),
            [Users, "members", "Members"],
            [Settings2, "settings", "Settings"],
          ].map(([Icon, key, label]) => {
            const I = Icon as typeof Users;
            return (
              <Link
                key={String(key)}
                href={preview ? "/preview?tab=" + key : base + "/" + key}
                className={section === key ? "active" : ""}
                aria-current={section === key ? "page" : undefined}
              >
                <I size={18} />
                {String(label)}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="foundation">
            <ShieldCheck size={19} />
            <strong>A strong foundation</strong>
            <p>
              Secure workspaces today.
              <br />
              Reliable automation next.
            </p>
          </div>
          {preview ? (
            <Link href="/auth/signup" className="sidebar-cta">
              Create an account <ArrowUpRight size={16} />
            </Link>
          ) : (
            <Logout />
          )}
        </div>
      </aside>
      <div className="workspace-body">
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span>{" "}
            <strong>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </strong>
          </span>
          <span className="status-pill">
            <span className="dot" />
            {preview ? "Read-only preview" : "Foundation workspace"}
          </span>
        </header>
        <main id="main" className="dashboard">
          {children}
        </main>
        <footer className="workspace-footer">
          BUILT FOR WHAT’S NEXT <span>FutureFlow · Phase 1</span>
        </footer>
      </div>
    </div>
  );
}
