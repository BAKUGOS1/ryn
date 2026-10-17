import {
  dispatchEvents,
  processWorkflowEvent,
} from "@/features/automations/worker";
import { z } from "zod";
import { NonRetriableError } from "inngest";
import { inngest } from "./client";
import {
  dispatch,
  processProbe,
  processDelivery,
} from "@/features/monitoring/worker";
import { workerRepository } from "@/features/monitoring/repository";
import { automationEnv, monitoringEnv } from "@/features/monitoring/runtime";
import { probe } from "@/features/monitoring/safe-http";
import { sendEmail } from "@/features/monitoring/email";
const eventData = z
  .object({ organizationId: z.uuid(), jobId: z.uuid() })
  .strict();
export const schedule = inngest.createFunction(
  {
    id: "monitor-dispatch",
    triggers: [{ cron: "* * * * *" }],
    concurrency: 1,
    retries: 3,
  },
  async ({ step }) => {
    await step.run("event-intake-relay", () =>
      dispatchEvents(workerRepository(), async (row) => {
        await inngest.send({
          id: `${row.id}:${row.attempt}`,
          name: "futureflow/workflow.event",
          data: { organizationId: row.organization_id, jobId: row.job_id },
        });
      }),
    );
    return step.run("claim-and-relay", () =>
      dispatch(
        workerRepository(),
        async (row) => {
          await inngest.send({
            id: `${row.id}:${row.attempt}`,
            name: "futureflow/monitor." + row.kind,
            data: { organizationId: row.organization_id, jobId: row.job_id },
          });
        },
        !!monitoringEnv(),
      ),
    );
  },
);
export const probes = inngest.createFunction(
  {
    id: "monitor-probe",
    triggers: [{ event: "futureflow/monitor.probe" }],
    concurrency: [
      { limit: 2, key: "event.data.organizationId" },
      { limit: 10 },
    ],
    retries: 4,
  },
  async ({ event, step }) => {
    const data = eventData.safeParse(event.data);
    if (!data.success) throw new NonRetriableError("invalid_event");
    const env = monitoringEnv();
    if (!env) throw new NonRetriableError("monitoring_disabled");
    return step.run("probe-and-record", () =>
      processProbe(
        workerRepository(),
        data.data.organizationId,
        data.data.jobId,
        (lease) => probe(lease.definition.url, env.allowedHosts),
      ),
    );
  },
);
export const deliveries = inngest.createFunction(
  {
    id: "monitor-notification",
    triggers: [{ event: "futureflow/monitor.delivery" }],
    concurrency: { limit: 2, key: "event.data.organizationId" },
    retries: 4,
  },
  async ({ event, step }) => {
    const data = eventData.safeParse(event.data);
    if (!data.success) throw new NonRetriableError("invalid_event");
    const env = automationEnv();
    if (!env) throw new NonRetriableError("monitoring_disabled");
    return step.run("send-and-record", () =>
      processDelivery(
        workerRepository(),
        data.data.organizationId,
        data.data.jobId,
        (lease) =>
          sendEmail(
            {
              id: lease.job_id,
              to: lease.recipient,
              subject: lease.subject,
              text: lease.text,
              firstAttemptAt: lease.first_attempt_at,
            },
            { apiKey: env.emailKey, from: env.from },
          ),
      ),
    );
  },
);

export const events = inngest.createFunction(
  {
    id: "workflow-event",
    triggers: [{ event: "futureflow/workflow.event" }],
    concurrency: [
      { limit: 2, key: "event.data.organizationId" },
      { limit: 10 },
    ],
    retries: 4,
  },
  async ({ event, step }) => {
    const data = eventData.safeParse(event.data);
    if (!data.success) throw new NonRetriableError("invalid_event");
    return step.run("evaluate-and-queue-actions", () =>
      processWorkflowEvent(
        workerRepository(),
        data.data.organizationId,
        data.data.jobId,
      ),
    );
  },
);
