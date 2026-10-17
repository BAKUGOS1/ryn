import { z } from "zod";
export const monitorInput = z
  .object({
    organizationId: z.uuid(),
    name: z.string().trim().min(2).max(80),
    url: z.url().max(2048),
    intervalMinutes: z.number().int().min(15).max(1440),
    recipientId: z.uuid(),
  })
  .strict();
export const probeEvidence = z
  .object({
    outcome: z.enum(["healthy", "unhealthy", "timeout", "network", "blocked"]),
    statusCode: z.number().int().min(100).max(599).nullable(),
    durationMs: z.number().int().min(0).max(15000),
  })
  .strict();
export type Evidence = z.infer<typeof probeEvidence>;
export interface ProbeLease {
  organization_id: string;
  job_id: string;
  token: string;
  definition: {
    schemaVersion: 1;
    url: string;
    intervalMinutes: number;
    recipientId: string;
  };
  monitor_name: string;
}
export interface DeliveryLease {
  organization_id: string;
  job_id: string;
  token: string;
  first_attempt_at: string;
  recipient: string;
  subject: string;
  text: string;
}
export interface OutboxLease {
  id: string;
  organization_id: string;
  kind: "probe" | "delivery";
  job_id: string;
  token: string;
  attempt: number;
}
