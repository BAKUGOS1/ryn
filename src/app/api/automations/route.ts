import { randomUUID } from "node:crypto";
import { authorize } from "@/lib/auth";
import {
  body,
  checkOrigin,
  dbError,
  failure,
  HttpError,
  json,
} from "@/lib/http";
import { draftInput } from "@/features/automations/schema";
import {
  readKeyring,
  newSigningSecret,
  encryptSecret,
} from "@/features/automations/webhook-security";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { organizationId, definition } = await body(request, draftInput);
    const { db, role } = await authorize(organizationId, "edit");
    let sourceId: string | null = null,
      secret: string | null = null,
      encrypted: unknown = null;
    if (definition.trigger.type === "webhook.signed") {
      if (!["owner", "admin"].includes(role))
        throw new HttpError(
          403,
          "Only workspace admins can create webhook sources.",
        );
      const ring = readKeyring();
      if (!ring)
        throw new HttpError(503, "Webhook encryption is not configured.");
      sourceId = randomUUID();
      secret = newSigningSecret();
      encrypted = encryptSecret(secret, organizationId, sourceId, ring);
    }
    const { data, error } = await db.rpc("create_workflow", {
      p_org: organizationId,
      p_definition: definition,
      p_source: sourceId,
      p_secret: encrypted,
    });
    dbError(error);
    return json({ id: data, sourceId, secret }, 201);
  } catch (e) {
    return failure(e);
  }
}
