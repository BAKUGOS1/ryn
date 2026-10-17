import { z } from "zod";
import { authorize } from "@/lib/auth";
import {
  body,
  checkOrigin,
  dbError,
  failure,
  HttpError,
  json,
} from "@/lib/http";
import { monitoringEnv } from "@/features/monitoring/runtime";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const { id } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "Invalid monitor.");
    const v = await body(
      request,
      z
        .object({
          organizationId: z.uuid(),
          state: z.enum(["active", "paused"]),
        })
        .strict(),
    );
    const { db } = await authorize(v.organizationId, "edit");
    if (v.state === "active" && !monitoringEnv())
      throw new HttpError(503, "Monitoring is not connected.");
    const { error } = await db.rpc("set_monitor_state", {
      p_org: v.organizationId,
      p_monitor: id,
      p_state: v.state,
    });
    dbError(error);
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
