import { createClient } from "@/lib/supabase/server";
import { monitoringEnv } from "@/features/monitoring/runtime";
import {
  can,
  type Role,
  type Membership,
} from "@/features/organizations/model";
import { CreateMonitor, MonitorState } from "./monitor-forms";
function date(value: string) {
  return new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}
export async function MonitoringPanel({
  id,
  role,
  members,
}: {
  id: string;
  role: Role;
  members: Membership[];
}) {
  const db = await createClient();
  const [monitors, probes, runs, incidents, usage] = await Promise.all([
    db
      .from("monitors")
      .select("id,name,state,failures,next_run_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false }),
    db
      .from("probe_jobs")
      .select("id,monitor_id,state,scheduled_at,attempts,evidence")
      .eq("organization_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(20),
    db
      .from("monitor_runs")
      .select("id,monitor_id,transition,state,steps,created_at")
      .eq("organization_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("monitor_incidents")
      .select("id,monitor_id,opened_at,resolved_at")
      .eq("organization_id", id)
      .order("opened_at", { ascending: false })
      .limit(20),
    db
      .from("monitor_usage")
      .select("metric,quantity,period")
      .eq("organization_id", id)
      .order("period", { ascending: false })
      .limit(3),
  ]);
  if ([monitors, probes, runs, incidents, usage].some((r) => r.error))
    return (
      <section className="panel">
        <h2>Monitoring setup is incomplete.</h2>
        <p>
          The monitoring database migration must be applied in your development
          project before this view is available.
        </p>
      </section>
    );
  const enabled = !!monitoringEnv();
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">FROM SIGNAL TO ACTION</span>
          <h1>Know when it matters.</h1>
          <p className="muted">
            Two consecutive failures open an incident. A healthy check resolves
            it.
          </p>
        </div>
        <span className="tag">
          {enabled ? "Worker configured" : "Not connected"}
        </span>
      </div>
      {!enabled && (
        <aside className="setup-note">
          <strong>Monitoring is disabled</strong>
          <p>
            Worker, email provider and approved targets need configuration. No
            probes or alerts are being sent.
          </p>
        </aside>
      )}
      <p className="quiet">
        Development limits shared by this workspace: 3 monitors · 3,000 probes ·
        300 qualified runs · 100 alerts per UTC month. Polling without a
        transition does not spend a run. Timings are best effort.
      </p>
      <div className="members-grid">
        <section className="panel">
          <h2>Website monitors</h2>
          {monitors.data?.length ? (
            monitors.data.map((m) => (
              <article className="member-row" key={m.id}>
                <div>
                  <h3>{m.name}</h3>
                  <p>
                    {m.state} · {m.failures} consecutive failures
                  </p>
                  <p>Next due: {date(m.next_run_at)} IST</p>
                </div>
                {can(role, "edit") && (enabled || m.state === "active") && (
                  <MonitorState organizationId={id} id={m.id} state={m.state} />
                )}
              </article>
            ))
          ) : (
            <p className="muted">
              No monitors yet. Create one paused, then activate it when you’re
              ready.
            </p>
          )}
        </section>
        {can(role, "edit") && enabled && (
          <section className="panel">
            <h2>Your first reliable signal.</h2>
            <p className="muted">
              Monitor only endpoints you own or have permission to check.
            </p>
            <CreateMonitor
              organizationId={id}
              recipients={members.filter((m) => m.status === "active")}
            />
          </section>
        )}
      </div>
      <section className="panel pending-invites">
        <h2>Incidents</h2>
        {incidents.data?.length ? (
          incidents.data.map((i) => (
            <div className="member-row" key={i.id}>
              <div>
                <strong>
                  {monitors.data?.find((m) => m.id === i.monitor_id)?.name ??
                    "Monitor"}
                </strong>
                <p>Opened {date(i.opened_at)} IST</p>
              </div>
              <span className="tag">
                {i.resolved_at ? "Resolved " + date(i.resolved_at) : "Open"}
              </span>
            </div>
          ))
        ) : (
          <p className="muted">No incidents recorded.</p>
        )}
      </section>
      <section className="panel pending-invites">
        <h2>Recent transition runs</h2>
        {runs.data?.length ? (
          runs.data.map((r) => (
            <details className="run-evidence" key={r.id}>
              <summary>
                {r.transition} · {r.state} · {date(r.created_at)} IST
              </summary>
              <p className="quiet">
                Run {r.id} · Immutable version recorded in database
              </p>
              <pre>{JSON.stringify(r.steps, null, 2)}</pre>
            </details>
          ))
        ) : (
          <p className="muted">
            Run history appears when a monitor changes incident state.
          </p>
        )}
      </section>
      <section className="panel pending-invites">
        <h2>Recent checks</h2>
        {probes.data?.length ? (
          probes.data.map((p) => (
            <details className="run-evidence" key={p.id}>
              <summary>
                {monitors.data?.find((m) => m.id === p.monitor_id)?.name ??
                  "Monitor"}{" "}
                · {p.state} · {date(p.scheduled_at)} IST
              </summary>
              <p>Attempts: {p.attempts}</p>
              <pre>
                {JSON.stringify(
                  p.evidence ?? { status: "awaiting_evidence" },
                  null,
                  2,
                )}
              </pre>
            </details>
          ))
        ) : (
          <p className="muted">No checks have been accepted yet.</p>
        )}
      </section>
      <section className="panel pending-invites">
        <h2>Usage by meter</h2>
        {usage.data?.length ? (
          usage.data.map((u) => (
            <p key={u.metric + "-" + u.period}>
              {u.metric}: {u.quantity} · Period {u.period}
            </p>
          ))
        ) : (
          <p className="muted">No usage recorded.</p>
        )}
      </section>
    </>
  );
}
