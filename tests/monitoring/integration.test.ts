import { beforeAll, afterAll, beforeEach, it, expect } from "vitest";
import { harness, users } from "./harness";
import {
  processProbe,
  processDelivery,
  dispatch,
} from "@/features/monitoring/worker";
import { DeliveryError } from "@/features/monitoring/email";
import type {
  Evidence,
  OutboxLease,
  DeliveryLease,
  ProbeLease,
} from "@/features/monitoring/contract";
let h: Awaited<ReturnType<typeof harness>>,
  ctx: { a: string; b: string; monitor: string };
const failed: Evidence = {
  outcome: "unhealthy",
  statusCode: 503,
  durationMs: 14,
};
const healthy: Evidence = {
  outcome: "healthy",
  statusCode: 200,
  durationMs: 10,
};
beforeAll(async () => {
  h = await harness();
});
afterAll(async () => {
  await h.db.close();
});
beforeEach(async () => {
  ctx = await h.reset();
});
async function check(evidence: Evidence) {
  const id = await h.due(ctx.a, ctx.monitor);
  await processProbe(h.rpc, ctx.a, id, async () => evidence);
  return id;
}
async function rows(table: string) {
  return (await h.admin("select * from public." + table)).rows;
}
it("executes failure -> failure -> repeated failure -> recovery with one alert per transition", async () => {
  await check(failed);
  expect(await rows("monitor_runs")).toHaveLength(0);
  await check(failed);
  await check(failed);
  expect(await rows("monitor_incidents")).toHaveLength(1);
  expect(await rows("monitor_runs")).toHaveLength(1);
  const sent: string[] = [];
  for (const delivery of await rows("monitor_deliveries"))
    await processDelivery(
      h.rpc,
      ctx.a,
      delivery.id as string,
      async (lease) => {
        sent.push(lease.job_id);
        return "mail-1";
      },
    );
  await check(healthy);
  for (const delivery of (await rows("monitor_deliveries")).filter(
    (d) => d.state === "queued",
  ))
    await processDelivery(
      h.rpc,
      ctx.a,
      delivery.id as string,
      async (lease) => {
        sent.push(lease.job_id);
        return "mail-2";
      },
    );
  expect(sent).toHaveLength(2);
  expect(new Set(sent).size).toBe(2);
  expect((await rows("monitor_incidents"))[0].resolved_at).not.toBeNull();
  expect((await rows("monitor_runs")).map((r) => r.state)).toEqual([
    "succeeded",
    "succeeded",
  ]);
  expect(
    (await rows("monitor_usage")).find((r) => r.metric === "probe")?.quantity,
  ).toBe(4);
  expect(
    (await rows("monitor_usage")).find((r) => r.metric === "run")?.quantity,
  ).toBe(2);
});
it("ignores duplicate jobs without probing or consuming another unit", async () => {
  const job = await check(failed);
  let called = 0;
  await processProbe(h.rpc, ctx.a, job, async () => {
    called++;
    return failed;
  });
  expect(called).toBe(0);
  expect((await rows("monitors"))[0].failures).toBe(1);
  expect(await rows("monitor_usage_ledger")).toHaveLength(1);
});
it("fences stale workers and reserves only one probe on lease recovery", async () => {
  const job = await h.due(ctx.a, ctx.monitor);
  const lease = (await h.rpc("claim_probe", {
    p_org: ctx.a,
    p_job: job,
  })) as ProbeLease;
  await h.admin(
    "update public.probe_jobs set lease_until=now()-interval '1 second'",
  );
  await h.admin(
    "update private.monitor_host_leases set last_started_at=now()-interval '2 seconds'",
  );
  const newer = (await h.rpc("claim_probe", {
    p_org: ctx.a,
    p_job: job,
  })) as ProbeLease;
  expect(newer.token).not.toBe(lease.token);
  await h.rpc("finish_probe", {
    p_org: ctx.a,
    p_job: job,
    p_token: lease.token,
    p_evidence: failed,
  });
  expect((await rows("monitors"))[0].failures).toBe(0);
  await h.rpc("finish_probe", {
    p_org: ctx.a,
    p_job: job,
    p_token: newer.token,
    p_evidence: failed,
  });
  expect((await rows("monitors"))[0].failures).toBe(1);
  expect((await rows("monitor_usage"))[0].quantity).toBe(1);
});
it("does not record stale network failures after pause", async () => {
  const job = await h.due(ctx.a, ctx.monitor);
  const lease = (await h.rpc("claim_probe", {
    p_org: ctx.a,
    p_job: job,
  })) as ProbeLease;
  await h.as(users.a);
  await h.query("select public.set_monitor_state($1,$2,$3)", [
    ctx.a,
    ctx.monitor,
    "paused",
  ]);
  await h.rpc("finish_probe", {
    p_org: ctx.a,
    p_job: job,
    p_token: lease.token,
    p_evidence: failed,
  });
  expect((await rows("monitors"))[0].failures).toBe(0);
  expect((await rows("probe_jobs"))[0].state).toBe("skipped");
});
it("blocks another tenant and authenticated worker-RPC access", async () => {
  const job = await h.due(ctx.a, ctx.monitor);
  expect(await h.rpc("claim_probe", { p_org: ctx.b, p_job: job })).toBeNull();
  await h.as(users.b);
  for (const table of [
    "monitors",
    "monitor_versions",
    "probe_jobs",
    "monitor_runs",
    "monitor_incidents",
    "monitor_deliveries",
    "monitor_usage_ledger",
  ])
    expect((await h.query("select * from public." + table)).rows).toHaveLength(
      0,
    );
  await expect(
    h.query("select public.dispatch_monitors()"),
  ).rejects.toMatchObject({ code: "42501" });
  await expect(
    h.query("select public.set_monitor_state($1,$2,'active')", [
      ctx.a,
      ctx.monitor,
    ]),
  ).rejects.toMatchObject({ code: "FF001" });
});
it("rejects cross-tenant foreign keys and published version mutation", async () => {
  await h.admin("select 1");
  await expect(
    h.query("update public.monitor_versions set definition=$1", ["{}"]),
  ).rejects.toMatchObject({ code: "23514" });
  const version = (await rows("monitor_versions"))[0].id;
  await expect(
    h.query(
      "insert into public.probe_jobs(organization_id,monitor_id,version_id,scheduled_at) values($1,$2,$3,now())",
      [ctx.b, ctx.monitor, version],
    ),
  ).rejects.toMatchObject({ code: "23503" });
});
it("keeps normal checks out of the run meter and respects probe quota", async () => {
  await check(healthy);
  expect(await rows("monitor_runs")).toHaveLength(0);
  await h.admin(
    "update public.monitor_usage set quantity=3000 where metric='probe'",
  );
  await check(failed);
  expect(
    (await rows("probe_jobs")).filter((j) => j.state === "skipped"),
  ).toHaveLength(1);
  expect((await rows("monitors"))[0].failures).toBe(0);
});
it("does not count policy-blocked targets as outages", async () => {
  await check({ outcome: "blocked", statusCode: null, durationMs: 1 });
  await check({ outcome: "blocked", statusCode: null, durationMs: 1 });
  expect(await rows("monitor_incidents")).toHaveLength(0);
});
it("transactional outbox survives publish failure, then acknowledges with a fence", async () => {
  const envelopes: OutboxLease[] = [];
  await dispatch(h.rpc, async (e) => {
    envelopes.push(e);
    throw new Error("transport down");
  });
  expect(envelopes).toHaveLength(1);
  const outbox = (await h.admin("select * from private.monitor_outbox"))
    .rows[0];
  expect(outbox.state).toBe("pending");
  await h.admin(
    "update private.monitor_outbox set next_attempt_at=now()-interval '1 second'",
  );
  await dispatch(h.rpc, async (e) => {
    envelopes.push(e);
  });
  expect(
    (await h.admin("select * from private.monitor_outbox")).rows[0].state,
  ).toBe("published");
  expect(envelopes[1].job_id).toBe(envelopes[0].job_id);
  expect(envelopes[1].attempt).toBe(2);
});
it("retries an ambiguous provider response with the same logical delivery id", async () => {
  await check(failed);
  await check(failed);
  const d = (await rows("monitor_deliveries"))[0];
  const attempts: string[] = [];
  await expect(
    processDelivery(h.rpc, ctx.a, d.id as string, async (lease) => {
      attempts.push(lease.job_id);
      throw new DeliveryError("retry", "provider_outcome_unknown");
    }),
  ).rejects.toThrow("notification_retry_required");
  await processDelivery(h.rpc, ctx.a, d.id as string, async (lease) => {
    attempts.push(lease.job_id);
    return "provider-1";
  });
  await processDelivery(h.rpc, ctx.a, d.id as string, async () => {
    throw new Error("duplicate send");
  });
  expect(attempts).toEqual([d.id, d.id]);
  expect((await rows("monitor_runs"))[0].state).toBe("succeeded");
  expect(
    (await rows("monitor_usage")).find((u) => u.metric === "notification")
      ?.quantity,
  ).toBe(1);
});
it("does not send again beyond the provider idempotency window", async () => {
  await check(failed);
  await check(failed);
  const d = (await rows("monitor_deliveries"))[0];
  await h.admin(
    "update public.monitor_deliveries set first_attempt_at=now()-interval '24 hours'",
  );
  let sent = false;
  await processDelivery(h.rpc, ctx.a, d.id as string, async () => {
    sent = true;
    return "oops";
  });
  expect(sent).toBe(false);
  expect((await rows("monitor_deliveries"))[0].state).toBe("requires_review");
});
it("skips alerts to suspended recipients and after workspace archive", async () => {
  await check(failed);
  await check(failed);
  const d = (await rows("monitor_deliveries"))[0];
  await h.admin(
    "update public.organization_members set status='suspended' where organization_id=$1",
    [ctx.a],
  );
  expect(
    await h.rpc("claim_monitor_delivery", { p_org: ctx.a, p_job: d.id }),
  ).toBeNull();
  expect((await rows("monitor_deliveries"))[0].state).toBe("skipped");
});
it("stale notification completions cannot regress a finished run", async () => {
  await check(failed);
  await check(failed);
  const d = (await rows("monitor_deliveries"))[0];
  const lease = (await h.rpc("claim_monitor_delivery", {
    p_org: ctx.a,
    p_job: d.id,
  })) as DeliveryLease;
  await h.rpc("finish_monitor_delivery", {
    p_org: ctx.a,
    p_job: d.id,
    p_token: lease.token,
    p_result: "succeeded",
    p_provider_id: "mail",
    p_error: null,
  });
  await h.rpc("finish_monitor_delivery", {
    p_org: ctx.a,
    p_job: d.id,
    p_token: lease.token,
    p_result: "requires_review",
    p_provider_id: null,
    p_error: "late",
  });
  expect((await rows("monitor_deliveries"))[0].state).toBe("succeeded");
});
it("pause/resume fencing rejects a pre-pause probe", async () => {
  const job = await h.due(ctx.a, ctx.monitor);
  const lease = (await h.rpc("claim_probe", {
    p_org: ctx.a,
    p_job: job,
  })) as ProbeLease;
  await h.as(users.a);
  await h.query("select public.set_monitor_state($1,$2,'paused')", [
    ctx.a,
    ctx.monitor,
  ]);
  await h.query("select public.set_monitor_state($1,$2,'active')", [
    ctx.a,
    ctx.monitor,
  ]);
  await h.rpc("finish_probe", {
    p_org: ctx.a,
    p_job: job,
    p_token: lease.token,
    p_evidence: failed,
  });
  expect((await rows("monitors"))[0].failures).toBe(0);
  expect((await rows("probe_jobs"))[0].state).toBe("skipped");
});
it("records a recovery even when the qualified run quota is exhausted", async () => {
  await check(failed);
  await check(failed);
  await h.admin(
    "update public.monitor_usage set quantity=300 where metric='run'",
  );
  await check(healthy);
  expect((await rows("monitor_incidents"))[0].resolved_at).not.toBeNull();
  expect(
    (await rows("monitor_runs")).find((r) => r.transition === "recovery")
      ?.state,
  ).toBe("skipped");
  expect(await rows("monitor_deliveries")).toHaveLength(1);
});
it("rolls back the whole transition when its notification transaction fails", async () => {
  await check(failed);
  const job = await h.due(ctx.a, ctx.monitor);
  const lease = (await h.rpc("claim_probe", {
    p_org: ctx.a,
    p_job: job,
  })) as ProbeLease;
  await h.admin(
    `create function private.test_delivery_failure() returns trigger language plpgsql as $$begin raise exception 'test rollback';end;$$`,
  );
  await h.admin(
    `create trigger test_fail before insert on public.monitor_deliveries for each row execute function private.test_delivery_failure()`,
  );
  await expect(
    h.rpc("finish_probe", {
      p_org: ctx.a,
      p_job: job,
      p_token: lease.token,
      p_evidence: failed,
    }),
  ).rejects.toThrow("test rollback");
  expect(await rows("monitor_runs")).toHaveLength(0);
  expect(await rows("monitor_incidents")).toHaveLength(0);
  expect((await rows("monitors"))[0].failures).toBe(1);
  await h.admin("drop trigger test_fail on public.monitor_deliveries");
  await h.admin("drop function private.test_delivery_failure()");
});
it("surfaces exhausted transport attempts on the durable job instead of leaving it queued forever", async () => {
  const job = await h.due(ctx.a, ctx.monitor);
  await h.admin(
    "update private.monitor_outbox set attempts=12 where probe_id=$1",
    [job],
  );
  await h.rpc("claim_monitor_outbox");
  expect((await rows("probe_jobs"))[0].state).toBe("requires_review");
  expect(
    (await h.admin("select state from private.monitor_outbox")).rows[0].state,
  ).toBe("requires_review");
});
