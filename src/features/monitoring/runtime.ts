import "server-only";
import { z } from "zod";
export function monitoringEnv(
  source: Record<string, string | undefined> = process.env,
) {
  if (source.MONITORING_ENABLED !== "true") return null;
  const result = z
    .object({
      url: z.url(),
      serviceKey: z.string().min(20),
      signingKey: z.string().min(20),
      eventKey: z.string().min(20),
      emailKey: z.string().min(10),
      from: z.email(),
      hosts: z.string().min(1),
    })
    .safeParse({
      url: source.NEXT_PUBLIC_SUPABASE_URL,
      serviceKey: source.SUPABASE_SECRET_KEY,
      signingKey: source.INNGEST_SIGNING_KEY,
      eventKey: source.INNGEST_EVENT_KEY,
      emailKey: source.RESEND_API_KEY,
      from: source.ALERT_FROM_EMAIL,
      hosts: source.MONITOR_ALLOWED_HOSTS,
    });
  if (!result.success) return null;
  const allowedHosts = result.data.hosts
    .split(",")
    .map((x) => x.trim().toLowerCase());
  if (
    allowedHosts.some(
      (h) => !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(h),
    )
  )
    return null;
  return { ...result.data, allowedHosts };
}
