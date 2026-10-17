import { authorize } from "@/lib/auth";
import {
  body,
  checkOrigin,
  dbError,
  failure,
  HttpError,
  json,
} from "@/lib/http";
import { monitorInput } from "@/features/monitoring/contract";
import { targetUrl, resolveTarget } from "@/features/monitoring/safe-http";
import { monitoringEnv } from "@/features/monitoring/runtime";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const v = await body(request, monitorInput);
    const { db } = await authorize(v.organizationId, "edit");
    const env = monitoringEnv();
    if (!env)
      throw new HttpError(
        503,
        "Monitoring is not connected. Configure the worker and email provider first.",
      );
    let url: URL;
    try {
      url = targetUrl(v.url, env.allowedHosts);
      await resolveTarget(url);
    } catch {
      throw new HttpError(400, "Choose a permitted public HTTPS target.");
    }
    const { data, error } = await db.rpc("create_monitor", {
      p_org: v.organizationId,
      p_name: v.name,
      p_url: url.href,
      p_interval: v.intervalMinutes,
      p_recipient: v.recipientId,
    });
    dbError(error);
    return json({ id: data }, 201);
  } catch (e) {
    return failure(e);
  }
}
