import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { definitionSchema, normalizeEvent } from "./schema";
import {
  decryptSecret,
  verifySignature,
  webhookHeaders,
  type Keyring,
} from "./webhook-security";
import type { Rpc } from "@/features/monitoring/repository";
const sourceSchema = z.object({
  source_id: z.uuid(),
  organization_id: z.uuid(),
  version_id: z.uuid(),
  revision: z.number().int(),
  definition: definitionSchema,
  secret: z.unknown(),
});
export async function receiveWebhook(
  request: Request,
  sourceId: string,
  rpc: Rpc,
  keyring: Keyring,
) {
  const response = (data: unknown, status: number) =>
    Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
  if (!z.uuid().safeParse(sourceId).success)
    return response({ error: "Webhook unavailable." }, 404);
  if (
    !/^application\/json(?:\s*;|$)/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    return response({ error: "JSON required." }, 415);
  const reader = request.body?.getReader();
  if (!reader) return response({ error: "Body required." }, 400);
  let length = 0;
  const parts: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 32768) {
      await reader.cancel();
      return response({ error: "Payload too large." }, 413);
    }
    parts.push(value);
  }
  const bytes = Buffer.concat(parts);
  const source = sourceSchema.safeParse(
    await rpc("lookup_webhook", { p_source: sourceId }),
  );
  if (!source.success) return response({ error: "Webhook unavailable." }, 404);
  let secret: string;
  try {
    secret = decryptSecret(
      source.data.secret,
      source.data.organization_id,
      sourceId,
      keyring,
    );
  } catch {
    return response({ error: "Webhook temporarily unavailable." }, 503);
  }
  if (!verifySignature(secret, request.headers, bytes))
    return response({ error: "Invalid webhook signature." }, 401);
  let payload: unknown;
  try {
    payload = JSON.parse(bytes.toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload))
      throw new Error();
  } catch {
    return response({ error: "Invalid JSON object." }, 400);
  }
  const fields = normalizeEvent(source.data.definition, payload);
  const result = await rpc("accept_webhook", {
    p_source: sourceId,
    p_revision: source.data.revision,
    p_version: source.data.version_id,
    p_event_key: webhookHeaders(request.headers).eventId,
    p_body_hash: createHash("sha256").update(bytes).digest("hex"),
    p_fields: fields,
  });
  const accepted = z
    .object({
      status: z.enum([
        "accepted",
        "duplicate",
        "conflict",
        "rate_limited",
        "unavailable",
        "quota",
      ]),
    })
    .parse(result);
  return response(
    { status: accepted.status },
    accepted.status === "accepted"
      ? 202
      : accepted.status === "duplicate"
        ? 200
        : accepted.status === "rate_limited" || accepted.status === "quota"
          ? 429
          : accepted.status === "conflict"
            ? 409
            : 404,
  );
}
