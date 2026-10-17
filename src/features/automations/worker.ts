import "server-only";
import { z } from "zod";
import { definitionSchema, evaluate } from "./schema";
import type { Rpc } from "@/features/monitoring/repository";
const leaseSchema = z.object({
  organization_id: z.uuid(),
  event_id: z.uuid(),
  token: z.uuid(),
  definition: definitionSchema,
  fields: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
});
export async function processWorkflowEvent(
  rpc: Rpc,
  organizationId: string,
  eventId: string,
) {
  const raw = await rpc("claim_workflow_event", {
    p_org: organizationId,
    p_event: eventId,
  });
  if (!raw) return { state: "not_claimed" };
  const lease = leaseSchema.parse(raw);
  if (lease.organization_id !== organizationId || lease.event_id !== eventId)
    throw new Error("tenant_context_mismatch");
  const result = evaluate(lease.definition, lease.fields);
  const recorded = await rpc("finish_workflow_event", {
    p_org: organizationId,
    p_event: eventId,
    p_token: lease.token,
    p_qualified: result.qualified,
    p_audit: result.audit,
    p_recipient: result.recipientId,
    p_trace: result.trace,
  });
  return { state: "recorded", result: recorded };
}
const eventEnvelope = z.object({
  id: z.uuid(),
  organization_id: z.uuid(),
  job_id: z.uuid(),
  kind: z.literal("event"),
  token: z.uuid(),
  attempt: z.number().int().positive(),
});
export async function dispatchEvents(
  rpc: Rpc,
  publish: (envelope: z.infer<typeof eventEnvelope>) => Promise<void>,
) {
  await rpc("dispatch_deadlines");
  const envelopes = z
    .array(eventEnvelope)
    .parse(await rpc("claim_event_outbox"));
  for (const envelope of envelopes) {
    try {
      await publish(envelope);
      await rpc("finish_event_outbox", {
        p_id: envelope.id,
        p_token: envelope.token,
        p_ok: true,
      });
    } catch {
      await rpc("finish_event_outbox", {
        p_id: envelope.id,
        p_token: envelope.token,
        p_ok: false,
      });
    }
  }
  return envelopes.length;
}
