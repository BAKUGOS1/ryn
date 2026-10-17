import "server-only";
import { z } from "zod";
import {
  probeEvidence,
  type Evidence,
  type ProbeLease,
  type DeliveryLease,
  type OutboxLease,
} from "./contract";
import { DeliveryError } from "./email";
import type { Rpc } from "./repository";
const envelope = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  kind: z.enum(["probe", "delivery"]),
  job_id: z.uuid(),
  token: z.uuid(),
  attempt: z.number().int().positive(),
});
const probeLease = z.object({
  organization_id: z.uuid(),
  job_id: z.uuid(),
  token: z.uuid(),
  monitor_name: z.string(),
  definition: z
    .object({
      schemaVersion: z.literal(1),
      url: z.url(),
      intervalMinutes: z.number().int().min(15),
      recipientId: z.uuid(),
    })
    .strict(),
});
const deliveryLease = z.object({
  organization_id: z.uuid(),
  job_id: z.uuid(),
  token: z.uuid(),
  first_attempt_at: z.string(),
  recipient: z.email(),
  subject: z.string().max(200),
  text: z.string().max(2000),
});
export async function dispatch(
  rpc: Rpc,
  publish: (event: OutboxLease) => Promise<void>,
) {
  await rpc("dispatch_monitors");
  const rows = z.array(envelope).parse(await rpc("claim_monitor_outbox"));
  for (const row of rows) {
    try {
      await publish(row);
      await rpc("finish_monitor_outbox", {
        p_id: row.id,
        p_token: row.token,
        p_ok: true,
      });
    } catch {
      await rpc("finish_monitor_outbox", {
        p_id: row.id,
        p_token: row.token,
        p_ok: false,
      });
    }
  }
  return rows.length;
}
export async function processProbe(
  rpc: Rpc,
  org: string,
  job: string,
  check: (lease: ProbeLease) => Promise<Evidence>,
) {
  const raw = await rpc("claim_probe", { p_org: org, p_job: job });
  if (!raw) return { status: "not_claimed" };
  const lease = probeLease.parse(raw);
  if (lease.organization_id !== org || lease.job_id !== job)
    throw new Error("tenant_context_mismatch");
  const evidence = probeEvidence.parse(await check(lease));
  const result = await rpc("finish_probe", {
    p_org: org,
    p_job: job,
    p_token: lease.token,
    p_evidence: evidence,
  });
  return { status: "recorded", result };
}
export async function processDelivery(
  rpc: Rpc,
  org: string,
  job: string,
  send: (lease: DeliveryLease) => Promise<string>,
) {
  const raw = await rpc("claim_monitor_delivery", { p_org: org, p_job: job });
  if (!raw) return { status: "not_claimed" };
  const lease = deliveryLease.parse(raw);
  if (lease.organization_id !== org || lease.job_id !== job)
    throw new Error("tenant_context_mismatch");
  let result = "succeeded",
    providerId: string | null = null,
    category: string | null = null;
  try {
    providerId = await send(lease);
  } catch (error) {
    result =
      error instanceof DeliveryError && error.disposition === "review"
        ? "requires_review"
        : "retry";
    category =
      error instanceof DeliveryError
        ? error.category
        : "provider_outcome_unknown";
  }
  await rpc("finish_monitor_delivery", {
    p_org: org,
    p_job: job,
    p_token: lease.token,
    p_result: result,
    p_provider_id: providerId,
    p_error: category,
  });
  if (result === "retry") throw new Error("notification_retry_required");
  return { status: result };
}
