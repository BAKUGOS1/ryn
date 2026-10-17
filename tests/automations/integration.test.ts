import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { harness, users } from "../monitoring/harness";
import {
  definitionSchema,
  type Definition,
} from "@/features/automations/schema";
import {
  encryptSecret,
  signature,
} from "@/features/automations/webhook-security";
import { receiveWebhook } from "@/features/automations/intake";
import {
  processWorkflowEvent,
  dispatchEvents,
} from "@/features/automations/worker";
import { processDelivery } from "@/features/monitoring/worker";
let h: Awaited<ReturnType<typeof harness>>,
  ctx: { a: string; b: string; monitor: string };
const ring = { active: "test", keys: { test: Buffer.alloc(32, 7) } },
  secret = "test-signing-secret";
const def = (): Definition =>
  definitionSchema.parse({
    schemaVersion: 1,
    name: "Priority alert",
    trigger: { type: "webhook.signed", config: {} },
    nodes: [
      {
        id: "check",
        type: "condition",
        config: { path: "priority", operator: "eq", value: "critical" },
      },
      {
        id: "notify",
        type: "action",
        config: {
          provider: "email",
          operation: "send_notification",
          recipientId: users.a,
        },
      },
    ],
    edges: [{ from: "check", to: "notify", when: "true" }],
  });
beforeAll(async () => {
  h = await harness();
});
afterAll(async () => {
  await h.db.close();
});
beforeEach(async () => {
  ctx = await h.reset();
});
async function rows(table: string) {
  return (await h.admin("select * from public." + table)).rows;
}
async function create(d = def(), publish = true) {
  const source = randomUUID();
  await h.as(users.a);
  const id = (
    await h.query("select public.create_workflow($1,$2,$3,$4) id", [
      ctx.a,
      JSON.stringify(d),
      d.trigger.type === "webhook.signed" ? source : null,
      d.trigger.type === "webhook.signed"
        ? JSON.stringify(encryptSecret(secret, ctx.a, source, ring))
        : null,
    ])
  ).rows[0].id as string;
  const version = publish
    ? ((
        await h.query("select public.publish_workflow($1,$2,1) id", [ctx.a, id])
      ).rows[0].id as string)
    : null;
  return { id, source, version };
}
function request(
  eventId = "event_1",
  payload: unknown = { priority: "critical" },
  key = secret,
) {
  const bytes = Buffer.from(JSON.stringify(payload));
  const ts = String(Math.floor(Date.now() / 1000));
  return new Request("https://example.com/api/events/webhook/source", {
    method: "POST",
    body: bytes,
    headers: {
      "content-type": "application/json",
      "x-futureflow-timestamp": ts,
      "x-futureflow-event-id": eventId,
      "x-futureflow-signature": "v1=" + signature(key, ts, eventId, bytes),
    },
  });
}
const intake = (source: string, id?: string, payload?: unknown, key?: string) =>
  receiveWebhook(request(id, payload, key), source, h.rpc, ring);
it("runs signed intake -> durable relay -> qualified graph -> shared email pipeline exactly once", async () => {
  const w = await create();
  expect((await intake(w.source)).status).toBe(202);
  expect((await intake(w.source)).status).toBe(200);
  const events = await rows("incoming_events");
  expect(events).toHaveLength(1);
  expect(events[0].fields).toEqual({ priority: "critical" });
  const sent: string[] = [];
  await dispatchEvents(h.rpc, async (e) => {
    sent.push(e.job_id);
  });
  expect(sent).toEqual([events[0].id]);
  await processWorkflowEvent(h.rpc, ctx.a, events[0].id as string);
  await processWorkflowEvent(h.rpc, ctx.a, events[0].id as string);
  const deliveries = await rows("monitor_deliveries");
  expect(deliveries).toHaveLength(1);
  let count = 0;
  await processDelivery(h.rpc, ctx.a, deliveries[0].id as string, async () => {
    count++;
    return "provider-test";
  });
  await processDelivery(h.rpc, ctx.a, deliveries[0].id as string, async () => {
    count++;
    return "duplicate";
  });
  expect(count).toBe(1);
  expect((await rows("workflow_runs"))[0].state).toBe("succeeded");
  const completedSteps = (await rows("workflow_runs"))[0].steps as {
    operation?: string;
    status: string;
  }[];
  if (completedSteps.some((step) => step.operation === "send_notification"))
    expect(
      completedSteps.find((step) => step.operation === "send_notification")
        ?.status,
    ).toBe("succeeded");
  for (const metric of ["intake", "run", "notification"])
    expect(
      (await rows("monitor_usage")).find((r) => r.metric === metric)?.quantity,
    ).toBe(1);
});
it("rejects signature failures and conflicting duplicate bodies without persisting raw payloads", async () => {
  const w = await create();
  expect((await intake(w.source, "bad", undefined, "wrong")).status).toBe(401);
  expect(
    (
      await intake(w.source, "event_1", {
        priority: "critical",
        password: "never-store",
      })
    ).status,
  ).toBe(202);
  expect((await intake(w.source, "event_1", { priority: "low" })).status).toBe(
    409,
  );
  expect(JSON.stringify(await rows("incoming_events"))).not.toContain(
    "never-store",
  );
  expect((await rows("monitor_usage"))[0].quantity).toBe(1);
});
it("filters unmatched events without consuming run/email units", async () => {
  const w = await create();
  await intake(w.source, "filtered", { priority: "low" });
  const e = (await rows("incoming_events"))[0];
  await processWorkflowEvent(h.rpc, ctx.a, e.id as string);
  expect((await rows("incoming_events"))[0].state).toBe("filtered");
  expect(await rows("workflow_runs")).toHaveLength(0);
  expect((await rows("monitor_usage")).map((r) => r.metric)).toEqual([
    "intake",
  ]);
});
it("keeps accepted events pinned to immutable published versions while drafts change", async () => {
  const w = await create();
  await intake(w.source);
  const d = def();
  d.name = "New publication";
  if (d.nodes[0].type === "condition") d.nodes[0].config.value = "low";
  await h.as(users.a);
  await h.query("select public.save_workflow($1,$2,2,$3)", [
    ctx.a,
    w.id,
    JSON.stringify(d),
  ]);
  await expect(
    h.query("select public.save_workflow($1,$2,2,$3)", [
      ctx.a,
      w.id,
      JSON.stringify(d),
    ]),
  ).rejects.toThrow("Draft changed");
  await h.query("select public.publish_workflow($1,$2,3)", [ctx.a, w.id]);
  const event = (await rows("incoming_events"))[0];
  await processWorkflowEvent(h.rpc, ctx.a, event.id as string);
  expect((await rows("workflow_runs"))[0].version_id).toBe(w.version);
  expect((await rows("monitor_deliveries"))[0].subject).toBe(
    "FutureFlow: Priority alert",
  );
  await expect(
    h.admin("update public.workflow_versions set definition='{}'"),
  ).rejects.toThrow();
});
it("rotates signing secrets immediately and fences a lookup made before rotation", async () => {
  const w = await create();
  const lookup = (await h.rpc("lookup_webhook", {
    p_source: w.source,
  })) as Record<string, unknown>;
  await h.as(users.a);
  await h.query("select public.rotate_webhook($1,$2,$3)", [
    ctx.a,
    w.id,
    JSON.stringify(encryptSecret("rotated", ctx.a, w.source, ring)),
  ]);
  expect((await intake(w.source, "old")).status).toBe(401);
  expect((await intake(w.source, "new", undefined, "rotated")).status).toBe(
    202,
  );
  expect(
    await h.rpc("accept_webhook", {
      p_source: w.source,
      p_revision: lookup.revision,
      p_version: lookup.version_id,
      p_event_key: "race",
      p_body_hash: "a".repeat(64),
      p_fields: {},
    }),
  ).toEqual({ status: "unavailable" });
});
it("fences in-flight work across pause/resume and never executes a foreign tenant event", async () => {
  const w = await create();
  await intake(w.source);
  const e = (await rows("incoming_events"))[0];
  expect(
    await h.rpc("claim_workflow_event", { p_org: ctx.b, p_event: e.id }),
  ).toBeNull();
  const lease = (await h.rpc("claim_workflow_event", {
    p_org: ctx.a,
    p_event: e.id,
  })) as Record<string, unknown>;
  await h.as(users.a);
  await h.query("select public.set_workflow_state($1,$2,'paused')", [
    ctx.a,
    w.id,
  ]);
  await h.query("select public.set_workflow_state($1,$2,'active')", [
    ctx.a,
    w.id,
  ]);
  expect(
    await h.rpc("finish_workflow_event", {
      p_org: ctx.a,
      p_event: e.id,
      p_token: lease.token,
      p_qualified: true,
      p_audit: false,
      p_recipient: users.a,
      p_trace: [],
    }),
  ).toBeNull();
  expect((await rows("incoming_events"))[0].state).toBe("skipped");
  expect(await rows("monitor_deliveries")).toHaveLength(0);
});
it("dispatches a deadline only once and honors its lead time", async () => {
  const d = def();
  const at = new Date(Date.now() + 86400000).toISOString();
  d.trigger = {
    type: "deadline.once",
    config: { at, timezone: "UTC", leadMinutes: 60 },
  };
  d.nodes = [
    {
      id: "record",
      type: "action",
      config: { provider: "internal", operation: "audit_record" },
    },
  ];
  d.edges = [];
  await create(d);
  const schedule = (await rows("deadline_schedules"))[0];
  expect(new Date(schedule.due_at as string).getTime()).toBe(
    new Date(at).getTime() - 3600000,
  );
  await h.admin(
    "update public.deadline_schedules set due_at=now()-interval '1 second'",
  );
  expect(await h.rpc("dispatch_deadlines")).toBe(1);
  expect(await h.rpc("dispatch_deadlines")).toBe(0);
  const e = (await rows("incoming_events"))[0];
  await processWorkflowEvent(h.rpc, ctx.a, e.id as string);
  expect((await rows("workflow_runs"))[0].state).toBe("succeeded");
  expect(
    (await rows("audit_logs")).some(
      (r) => r.action === "workflow.audit_record",
    ),
  ).toBe(true);
});
it("enforces tenant RLS and blocks direct writes, worker calls and secret reads", async () => {
  const w = await create();
  await h.as(users.b);
  expect((await h.query("select * from public.workflows")).rows).toHaveLength(
    0,
  );
  await expect(
    h.query("select public.publish_workflow($1,$2,2)", [ctx.a, w.id]),
  ).rejects.toThrow();
  await h.as(users.a);
  await expect(
    h.query("update public.workflows set name='bypass'"),
  ).rejects.toThrow("permission denied");
  await expect(
    h.query("select public.lookup_webhook($1)", [w.source]),
  ).rejects.toThrow("permission denied");
  await expect(
    h.query("select * from private.webhook_secrets"),
  ).rejects.toThrow("permission denied");
});
it("rejects malformed graphs through direct authoring RPC and permits archiving drafts", async () => {
  await h.as(users.a);
  const d = def();
  (d.nodes[0].config as unknown as Record<string, unknown>).operator = null;
  await expect(
    h.query("select public.create_workflow($1,$2,$3,$4)", [
      ctx.a,
      JSON.stringify(d),
      randomUUID(),
      "{}",
    ]),
  ).rejects.toThrow();
  const w = await create(def(), false);
  await h.query("select public.set_workflow_state($1,$2,'archived')", [
    ctx.a,
    w.id,
  ]);
  expect((await rows("workflows"))[0].state).toBe("archived");
});
it("limits unauthenticated signature attempts per source before accepting more work", async () => {
  const w = await create();
  for (let n = 0; n < 60; n++)
    expect(
      (await intake(w.source, "bad_" + n, undefined, "wrong")).status,
    ).toBe(401);
  expect((await intake(w.source, "too_many")).status).toBe(404);
  expect(await rows("incoming_events")).toHaveLength(0);
});
it("recovers failed relay publication with a stable event identity and fenced acknowledgements", async () => {
  const w = await create();
  await intake(w.source);
  await dispatchEvents(h.rpc, async () => {
    throw Error("transport unavailable");
  });
  let outbox = (await h.admin("select * from private.event_outbox")).rows[0];
  expect(outbox.state).toBe("pending");
  await h.admin(
    "update private.event_outbox set next_attempt_at=now()-interval '1 second'",
  );
  const lease = (
    (await h.rpc("claim_event_outbox")) as Record<string, unknown>[]
  )[0];
  await h.rpc("finish_event_outbox", {
    p_id: lease.id,
    p_token: randomUUID(),
    p_ok: true,
  });
  expect(
    (await h.admin("select state from private.event_outbox")).rows[0].state,
  ).toBe("publishing");
  await h.rpc("finish_event_outbox", {
    p_id: lease.id,
    p_token: lease.token,
    p_ok: true,
  });
  outbox = (await h.admin("select * from private.event_outbox")).rows[0];
  expect(outbox.state).toBe("published");
  expect(outbox.event_id).toBe((await rows("incoming_events"))[0].id);
});
it("shares run and notification ceilings with monitors and does not charge retries twice", async () => {
  const w = await create();
  await intake(w.source);
  await h.admin(
    "insert into public.monitor_usage(organization_id,period,metric,quantity) values($1,date_trunc('month',now() at time zone 'UTC')::date,'run',300)",
    [ctx.a],
  );
  const event = (await rows("incoming_events"))[0];
  await processWorkflowEvent(h.rpc, ctx.a, event.id as string);
  expect((await rows("incoming_events"))[0].state).toBe("skipped");
  expect(await rows("workflow_runs")).toHaveLength(0);
  expect(
    (await rows("monitor_usage")).find((r) => r.metric === "run")?.quantity,
  ).toBe(300);
});
it("revalidates removed notification recipients and updates generic run evidence", async () => {
  const w = await create();
  await intake(w.source);
  await processWorkflowEvent(
    h.rpc,
    ctx.a,
    (await rows("incoming_events"))[0].id as string,
  );
  await h.admin(
    "update auth.users set email='changed@example.com' where id=$1",
    [users.a],
  );
  let sent = false;
  await processDelivery(
    h.rpc,
    ctx.a,
    (await rows("monitor_deliveries"))[0].id as string,
    async () => {
      sent = true;
      return "forbidden";
    },
  );
  expect(sent).toBe(false);
  expect((await rows("workflow_runs"))[0].state).toBe("skipped");
});
it("rejects an oversized body before looking up or accepting a source", async () => {
  const w = await create();
  const response = await intake(w.source, "oversized", {
    payload: "a".repeat(33000),
  });
  expect(response.status).toBe(413);
  expect(
    (await h.admin("select * from private.webhook_rate")).rows,
  ).toHaveLength(0);
});
it("cancels superseded future deadline schedules when a new version is published", async () => {
  const d = def();
  d.trigger = {
    type: "deadline.once",
    config: {
      at: new Date(Date.now() + 86400000).toISOString(),
      timezone: "UTC",
      leadMinutes: 0,
    },
  };
  const w = await create(d);
  await h.as(users.a);
  await h.query("select public.publish_workflow($1,$2,2)", [ctx.a, w.id]);
  await h.admin(
    "update public.deadline_schedules set due_at=now()-interval '1 second'",
  );
  expect(await h.rpc("dispatch_deadlines")).toBe(1);
  const e = (await rows("incoming_events"))[0];
  expect(e.version_id).not.toBe(w.version);
});

it("records a terminal notification step when notification quota rejects the action", async () => {
  const w = await create();
  await h.admin(
    "insert into public.monitor_usage(organization_id,period,metric,quantity) values($1,date_trunc('month',now() at time zone 'UTC')::date,'notification',100)",
    [ctx.a],
  );
  await intake(w.source);
  await processWorkflowEvent(
    h.rpc,
    ctx.a,
    (await rows("incoming_events"))[0].id as string,
  );
  const run = (await rows("workflow_runs"))[0];
  expect(run.state).toBe("skipped");
  expect(
    (run.steps as { id: string; status: string }[]).find(
      (step) => step.id === "notify",
    )?.status,
  ).toBe("skipped");
  expect(await rows("monitor_deliveries")).toHaveLength(0);
});
it("synchronizes delivery retry exhaustion with its parent run immediately", async () => {
  const w = await create();
  await intake(w.source);
  await processWorkflowEvent(
    h.rpc,
    ctx.a,
    (await rows("incoming_events"))[0].id as string,
  );
  await h.admin(
    "update public.monitor_deliveries set attempts=5, first_attempt_at=now()-interval '1 minute'",
  );
  await h.rpc("recover_notification_deliveries");
  const run = (await rows("workflow_runs"))[0];
  expect((await rows("monitor_deliveries"))[0].state).toBe("requires_review");
  expect(run.state).toBe("requires_review");
  expect(
    (run.steps as { id: string; status: string }[]).find(
      (step) => step.id === "notify",
    )?.status,
  ).toBe("requires_review");
});
it("preserves uncertain-delivery review when the recipient becomes unavailable", async () => {
  const w = await create();
  await intake(w.source);
  await processWorkflowEvent(
    h.rpc,
    ctx.a,
    (await rows("incoming_events"))[0].id as string,
  );
  await h.admin(
    "update public.monitor_deliveries set attempts=1, first_attempt_at=now()-interval '24 hours'",
  );
  await h.admin(
    "update auth.users set email='changed@example.com' where id=$1",
    [users.a],
  );
  let sends = 0;
  await processDelivery(
    h.rpc,
    ctx.a,
    (await rows("monitor_deliveries"))[0].id as string,
    async () => {
      sends++;
      return "not-sent";
    },
  );
  expect(sends).toBe(0);
  expect((await rows("monitor_deliveries"))[0].state).toBe("requires_review");
  expect((await rows("workflow_runs"))[0].state).toBe("requires_review");
});
it("keeps a skipped email branch skipped when a different branch records an audit", async () => {
  const d = def();
  d.nodes.push({
    id: "audit",
    type: "action",
    config: { provider: "internal", operation: "audit_record" },
  });
  d.edges.push({ from: "check", to: "audit", when: "false" });
  const w = await create(d);
  await intake(w.source, "audit_branch", { priority: "low" });
  await processWorkflowEvent(
    h.rpc,
    ctx.a,
    (await rows("incoming_events"))[0].id as string,
  );
  const run = (await rows("workflow_runs"))[0];
  expect(run.state).toBe("succeeded");
  expect(
    (run.steps as { id: string; status: string }[]).find(
      (step) => step.id === "notify",
    )?.status,
  ).toBe("skipped");
  expect(await rows("monitor_deliveries")).toHaveLength(0);
});
it("rejects stale save/publish revisions and viewer writes through real SQL RPCs", async () => {
  const w = await create(def(), false);
  await h.as(users.a);
  const changed = { ...def(), name: "Saved draft" };
  expect(
    (
      await h.query("select public.save_workflow($1,$2,1,$3) revision", [
        ctx.a,
        w.id,
        JSON.stringify(changed),
      ])
    ).rows[0].revision,
  ).toBe(2);
  await expect(
    h.query("select public.save_workflow($1,$2,1,$3)", [
      ctx.a,
      w.id,
      JSON.stringify(def()),
    ]),
  ).rejects.toThrow("Draft changed");
  await expect(
    h.query("select public.publish_workflow($1,$2,1)", [ctx.a, w.id]),
  ).rejects.toThrow("Draft changed");
  await h.query("select public.publish_workflow($1,$2,2)", [ctx.a, w.id]);
  await h.query("select public.set_workflow_state($1,$2,'paused')", [
    ctx.a,
    w.id,
  ]);
  await expect(
    h.query("select public.save_workflow($1,$2,3,$3)", [
      ctx.a,
      w.id,
      JSON.stringify(def()),
    ]),
  ).rejects.toThrow("Draft changed");
  await h.admin(
    "insert into public.organization_members(organization_id,user_id,role,email) values($1,$2,'viewer','viewer@example.com')",
    [ctx.a, users.viewer],
  );
  await h.as(users.viewer);
  expect(
    (await h.query("select * from public.workflows where id=$1", [w.id])).rows,
  ).toHaveLength(1);
  await expect(
    h.query("select public.save_workflow($1,$2,4,$3)", [
      ctx.a,
      w.id,
      JSON.stringify(def()),
    ]),
  ).rejects.toThrow();
  await expect(
    h.query("select public.publish_workflow($1,$2,4)", [ctx.a, w.id]),
  ).rejects.toThrow();
  await expect(
    h.query("select public.set_workflow_state($1,$2,'active')", [ctx.a, w.id]),
  ).rejects.toThrow();
});
