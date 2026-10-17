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
import { definitionSchema } from "@/features/automations/schema";
import {
  readKeyring,
  newSigningSecret,
  encryptSecret,
} from "@/features/automations/webhook-security";
import { automationEnv } from "@/features/monitoring/runtime";
const input = z
  .object({
    organizationId: z.uuid(),
    revision: z.number().int().positive().optional(),
    definition: definitionSchema.optional(),
    state: z.enum(["active", "paused", "archived"]).optional(),
  })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
) {
  try {
    checkOrigin(request);
    const { id, action } = await params;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "Invalid workflow.");
    const v = await body(request, input);
    const { db, role } = await authorize(v.organizationId, "edit");
    let result;
    if (action === "save") {
      if (!v.definition || !v.revision)
        throw new HttpError(400, "Definition and draft revision are required.");
      result = await db.rpc("save_workflow", {
        p_org: v.organizationId,
        p_workflow: id,
        p_revision: v.revision,
        p_definition: v.definition,
      });
    } else if (action === "publish") {
      if (!v.revision) throw new HttpError(400, "Draft revision is required.");
      if (!automationEnv())
        throw new HttpError(
          503,
          "Configure the worker and email provider before publishing.",
        );
      result = await db.rpc("publish_workflow", {
        p_org: v.organizationId,
        p_workflow: id,
        p_revision: v.revision,
      });
    } else if (action === "state") {
      if (!v.state) throw new HttpError(400, "Workflow state is required.");
      if (v.state === "active" && !automationEnv())
        throw new HttpError(503, "Automation is not connected.");
      result = await db.rpc("set_workflow_state", {
        p_org: v.organizationId,
        p_workflow: id,
        p_state: v.state,
      });
    } else if (action === "rotate") {
      if (!["owner", "admin"].includes(role))
        throw new HttpError(403, "Only admins can rotate webhook secrets.");
      const ring = readKeyring();
      if (!ring)
        throw new HttpError(503, "Webhook encryption is not configured.");
      const { data: source, error } = await db
        .from("webhook_sources")
        .select("id")
        .eq("organization_id", v.organizationId)
        .eq("workflow_id", id)
        .single();
      dbError(error);
      if (!source) throw new HttpError(404, "Webhook source unavailable.");
      const secret = newSigningSecret();
      const { error: writeError } = await db.rpc("rotate_webhook", {
        p_org: v.organizationId,
        p_workflow: id,
        p_secret: encryptSecret(secret, v.organizationId, source.id, ring),
      });
      dbError(writeError);
      return json({ secret, sourceId: source.id });
    } else throw new HttpError(404, "Action unavailable.");
    dbError(result.error);
    return json({ ok: true, result: result.data });
  } catch (e) {
    return failure(e);
  }
}
