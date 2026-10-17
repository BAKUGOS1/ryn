import Link from "next/link";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Overview } from "@/components/overview";
export default async function Preview({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const section = tab === "members" || tab === "settings" ? tab : "overview";
  return (
    <WorkspaceShell
      preview
      org={{ id: "preview", name: "Acme studio" }}
      organizations={[{ id: "preview", name: "Acme studio" }]}
      section={section}
    >
      {section === "overview" ? (
        <Overview
          preview
          name="Acme studio"
          members={1}
          role="Owner"
          orgId="preview"
        />
      ) : (
        <>
          <span className="eyebrow">READ-ONLY DESIGN PREVIEW</span>
          <h1>
            {section === "members"
              ? "A place for your people."
              : "Make your workspace yours."}
          </h1>
          <section className="panel">
            <h2>
              {section === "members"
                ? "Clear roles. Thoughtful access."
                : "The essentials, in one place."}
            </h2>
            <p className="muted">
              {section === "members"
                ? "Owners and admins can create expiring invitations and manage access. Editors and viewers have limited permissions."
                : "Manage your workspace name and timezone. Only an owner can archive a workspace."}
            </p>
            <p>
              No sample changes are saved. Sign in after Supabase setup to use
              the real workspace.
            </p>
            <Link className="button button-primary" href="/auth/signup">
              Create your account →
            </Link>
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
