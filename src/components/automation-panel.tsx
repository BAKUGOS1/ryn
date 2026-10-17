import { createClient } from "@/lib/supabase/server";
import {
  can,
  type Role,
  type Membership,
} from "@/features/organizations/model";
import { automationEnv } from "@/features/monitoring/runtime";
import { readKeyring } from "@/features/automations/webhook-security";
import { StudioLauncher } from "./studio-launcher";
import {
  CreateAutomation,
  EditAutomation,
  WorkflowAction,
  RotateWebhook,
} from "./automation-forms";
export async function AutomationPanel({
  organizationId,
  role,
  members,
}: {
  organizationId: string;
  role: Role;
  members: Membership[];
}) {
  const db = await createClient();
  const [workflows, versions, sources, runs, events] = await Promise.all([
    db
      .from("workflows")
      .select("id,name,state,revision,draft,active_version_id")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
    db
      .from("workflow_versions")
      .select("id,workflow_id,version,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100),
    db
      .from("webhook_sources")
      .select("id,workflow_id,revision")
      .eq("organization_id", organizationId),
    db
      .from("workflow_runs")
      .select("id,workflow_id,version_id,state,steps,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("incoming_events")
      .select("id,workflow_id,occurrence_key,state,created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if ([workflows, versions, sources, runs, events].some((r) => r.error))
    return (
      <section className="panel">
        <h2>Automation setup required</h2>
        <p>
          Apply the event-automations migration in your development project to
          enable these workflows.
        </p>
      </section>
    );
  const configured = !!automationEnv();
  const elevated = role === "owner" || role === "admin";
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">THE RIGHT EVENT. THE RIGHT ACTION.</span>
          <h1>Make important moments count.</h1>
          <p className="muted">
            Signed webhooks and one-time deadline reminders, with immutable
            published versions.
          </p>
        </div>
        <span className="tag">
          {configured ? "Worker configured" : "Execution disabled"}
        </span>
      </div>
      {!configured && (
        <aside className="setup-note">
          <strong>Drafts are available. Execution is disabled.</strong>
          <p>
            Configure the worker and email provider before publishing or
            resuming a workflow.
          </p>
        </aside>
      )}
      <p className="quiet">
        Development safety limits: 3 event workflows · 1,000 webhook events ·
        300 qualified runs · 100 notifications per workspace / UTC month. Run
        and notification meters are shared with monitors.
      </p>
      <div className="members-grid">
        <section className="panel">
          <h2>Your workflows</h2>
          {workflows.data?.length ? (
            workflows.data.map((w) => {
              const source = sources.data?.find((s) => s.workflow_id === w.id);
              return (
                <article className="workflow-card" key={w.id}>
                  <h3>{w.name}</h3>
                  <p className="quiet">
                    {w.state} · Draft revision {w.revision} · Published version{" "}
                    {versions.data?.find((v) => v.id === w.active_version_id)
                      ?.version ?? "none"}
                  </p>
                  {source && (
                    <p className="quiet">
                      Webhook endpoint: /api/events/webhook/{source.id}
                      <br />
                      Signing revision {source.revision}
                    </p>
                  )}
                  {can(role, "edit") && w.state !== "archived" && (
                    <>
                      <StudioLauncher
                        organizationId={organizationId}
                        id={w.id}
                        revision={w.revision}
                        definition={w.draft}
                        recipients={members.filter(
                          (m) => m.status === "active",
                        )}
                      />
                      <details>
                        <summary>Edit draft JSON</summary>
                        <EditAutomation
                          key={w.revision}
                          organizationId={organizationId}
                          id={w.id}
                          revision={w.revision}
                          definition={w.draft}
                        />
                      </details>
                      {configured && (
                        <WorkflowAction
                          organizationId={organizationId}
                          id={w.id}
                          revision={w.revision}
                          action="publish"
                        />
                      )}
                      {w.active_version_id &&
                        (configured || w.state === "active") && (
                          <WorkflowAction
                            organizationId={organizationId}
                            id={w.id}
                            action="state"
                            state={w.state === "active" ? "paused" : "active"}
                          />
                        )}
                      <details>
                        <summary>Archive workflow</summary>
                        <WorkflowAction
                          organizationId={organizationId}
                          id={w.id}
                          action="state"
                          state="archived"
                        />
                      </details>
                      {source && elevated && (
                        <details>
                          <summary>Rotate webhook signing secret</summary>
                          <RotateWebhook
                            organizationId={organizationId}
                            id={w.id}
                          />
                        </details>
                      )}
                    </>
                  )}
                </article>
              );
            })
          ) : (
            <p className="muted">
              Create a draft, review its definition, then publish it when your
              integrations are ready.
            </p>
          )}
        </section>
        {can(role, "edit") && (
          <section className="panel">
            <h2>A useful starting point.</h2>
            <CreateAutomation
              organizationId={organizationId}
              recipients={members.filter((m) => m.status === "active")}
              canCreateWebhook={elevated && !!readKeyring()}
            />
            {!readKeyring() && (
              <p className="quiet">
                Webhook creation requires server-side encryption setup. Deadline
                drafts are available now.
              </p>
            )}
          </section>
        )}
      </div>
      <section className="panel pending-invites">
        <h2>Execution evidence</h2>
        {runs.data?.length ? (
          runs.data.map((r) => (
            <details className="run-evidence" key={r.id}>
              <summary>
                {workflows.data?.find((w) => w.id === r.workflow_id)?.name ??
                  "Workflow"}{" "}
                · {r.state} · Version{" "}
                {versions.data?.find((v) => v.id === r.version_id)?.version ??
                  "recorded"}
              </summary>
              <p className="quiet">
                Run {r.id} · {new Date(r.created_at).toISOString()}
              </p>
              {Array.isArray(r.steps) ? (
                <ol className="run-timeline">
                  {r.steps.map(
                    (
                      step: { id: string; status: string; operation?: string },
                      index: number,
                    ) => (
                      <li key={index}>
                        <strong>{step.id.replaceAll("_", " ")}</strong>
                        <span>{step.status.replaceAll("_", " ")}</span>
                        {step.operation && (
                          <small>{step.operation.replaceAll("_", " ")}</small>
                        )}
                      </li>
                    ),
                  )}
                </ol>
              ) : (
                <p>Evidence unavailable.</p>
              )}
            </details>
          ))
        ) : (
          <p className="muted">
            No qualified runs yet. Non-matching webhooks do not consume the
            workflow-run allowance.
          </p>
        )}
      </section>
      <section className="panel pending-invites">
        <h2>Recent events</h2>
        {events.data?.length ? (
          events.data.map((e) => (
            <div className="member-row" key={e.id}>
              <span>{e.occurrence_key}</span>
              <span className="tag">{e.state}</span>
            </div>
          ))
        ) : (
          <p className="muted">
            Accepted webhook events and dispatched deadline occurrences appear
            here.
          </p>
        )}
      </section>
    </>
  );
}
