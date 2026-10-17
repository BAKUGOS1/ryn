import { MonitoringPanel } from "@/components/monitoring-panel";
import { notFound, redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { readEnv } from "@/lib/env";
import {
  can,
  idSchema,
  type Organization,
  type Membership,
} from "@/features/organizations/model";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Overview } from "@/components/overview";
import {
  InviteForm,
  MemberControls,
  Revoke,
  SettingsForm,
  Archive,
} from "@/components/workspace-forms";
export default async function Workspace({
  params,
}: {
  params: Promise<{ org: string; section: string }>;
}) {
  if (!readEnv()) redirect("/auth/login");
  const { org: id, section } = await params;
  if (
    !idSchema.safeParse(id).success ||
    !["overview", "members", "settings", "monitors"].includes(section)
  )
    notFound();
  const ctx = await authorize(id).catch(() => null);
  if (!ctx) notFound();
  const { db, user, role } = ctx;
  const [orgs, members, settings] = await Promise.all([
    db.from("organizations").select("*").order("created_at"),
    db
      .from("organization_members")
      .select("*")
      .eq("organization_id", id)
      .order("joined_at"),
    db
      .from("organization_settings")
      .select("timezone")
      .eq("organization_id", id)
      .single(),
  ]);
  if (orgs.error || members.error || settings.error)
    throw new Error("Workspace unavailable");
  const org = orgs.data.find((o) => o.id === id) as Organization;
  if (!org) notFound();
  const list = members.data as Membership[];
  const invites = can(role, "invite")
    ? await db
        .from("organization_invites")
        .select("id,email,role,expires_at")
        .eq("organization_id", id)
        .is("accepted_at", null)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
    : null;
  if (invites?.error) throw new Error("Invitations unavailable");
  return (
    <WorkspaceShell org={org} organizations={orgs.data} section={section}>
      {section === "monitors" ? (
        <MonitoringPanel id={id} role={role} members={list} />
      ) : section === "overview" ? (
        <Overview
          name={org.name}
          members={list.filter((m) => m.status === "active").length}
          role={role}
          orgId={id}
        />
      ) : section === "members" ? (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">BETTER, TOGETHER</span>
              <h1>Your people.</h1>
              <p className="muted">
                Give everyone the access they need — and nothing more.
              </p>
            </div>
            <span className="tag">{list.length} members</span>
          </div>
          <div className="members-grid">
            <section className="panel">
              <h2>Workspace members</h2>
              {list.map((m) => (
                <div className="member-row" key={m.user_id}>
                  <div className="member-info">
                    <span className="workspace-avatar">
                      {m.email.charAt(0).toUpperCase()}
                    </span>
                    <span>
                      <strong>{m.email}</strong>
                      <small>
                        {m.role} · {m.status}
                        {m.user_id === user.id ? " · You" : ""}
                      </small>
                    </span>
                  </div>
                  {can(role, "members") &&
                    m.role !== "owner" &&
                    m.user_id !== user.id &&
                    (role === "owner" || m.role !== "admin") && (
                      <details>
                        <summary>Manage access</summary>
                        <MemberControls id={id} member={m} actorRole={role} />
                      </details>
                    )}
                </div>
              ))}
            </section>
            {can(role, "invite") && (
              <section className="panel">
                <h2>A new seat at the table.</h2>
                <p className="muted">
                  Create an email-bound, single-use link. You choose how to
                  share it.
                </p>
                <InviteForm id={id} role={role} />
              </section>
            )}
          </div>
          {can(role, "invite") && (
            <section className="panel pending-invites">
              <h2>Pending invitations</h2>
              {invites?.data?.length ? (
                invites.data.map((i) => (
                  <div className="member-row" key={i.id}>
                    <div>
                      <strong>{i.email}</strong>
                      <p>
                        {i.role} · Expires{" "}
                        {new Date(i.expires_at).toLocaleDateString("en-IN", {
                          timeZone: "Asia/Kolkata",
                        })}
                      </p>
                    </div>
                    <Revoke id={id} inviteId={i.id} />
                  </div>
                ))
              ) : (
                <p className="muted">
                  No pending invitations. Invite someone when you’re ready.
                </p>
              )}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">THE DETAILS MATTER</span>
              <h1>Make it yours.</h1>
              <p className="muted">
                A few essentials for a well-organized workspace.
              </p>
            </div>
          </div>
          <section className="panel settings-panel">
            <h2>Workspace details</h2>
            {can(role, "settings") ? (
              <SettingsForm
                id={id}
                name={org.name}
                timezone={settings.data.timezone}
              />
            ) : (
              <p>
                Your role can view this workspace. Ask an owner or admin to
                update its settings.
              </p>
            )}
            <p className="quiet">Workspace address: {org.slug}</p>
          </section>
          {role === "owner" && (
            <section className="panel settings-panel danger-panel">
              <h2>Archive workspace</h2>
              <p>
                This hides the workspace and revokes pending invitations. Data
                and audit records are retained. Restore requires an
                administrator.
              </p>
              <Archive id={id} />
            </section>
          )}
        </>
      )}
    </WorkspaceShell>
  );
}
