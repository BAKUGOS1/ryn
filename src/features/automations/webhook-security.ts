import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
const envelope = z
  .object({
    keyId: z.string().min(1).max(32),
    iv: z.string(),
    tag: z.string(),
    ciphertext: z.string(),
  })
  .strict();
export interface Keyring {
  active: string;
  keys: Record<string, Buffer>;
}
export function readKeyring(
  source: Record<string, string | undefined> = process.env,
): Keyring | null {
  try {
    const active = source.WEBHOOK_ACTIVE_KEY_ID;
    if (!active || !/^[a-z0-9_-]{1,32}$/.test(active)) return null;
    const encoded = z
      .record(z.string(), z.string())
      .parse(JSON.parse(source.WEBHOOK_ENCRYPTION_KEYS ?? ""));
    const keys: Record<string, Buffer> = {};
    for (const [id, value] of Object.entries(encoded)) {
      const key = Buffer.from(value, "base64");
      if (key.length !== 32) return null;
      keys[id] = key;
    }
    return keys[active] ? { active, keys } : null;
  } catch {
    return null;
  }
}
export function newSigningSecret() {
  return randomBytes(32).toString("hex");
}
export function encryptSecret(
  secret: string,
  organizationId: string,
  sourceId: string,
  ring: Keyring,
) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ring.keys[ring.active], iv);
  cipher.setAAD(Buffer.from("futureflow:" + organizationId + ":" + sourceId));
  const ciphertext = Buffer.concat([
    cipher.update(secret, "utf8"),
    cipher.final(),
  ]);
  return {
    keyId: ring.active,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}
export function decryptSecret(
  encoded: unknown,
  organizationId: string,
  sourceId: string,
  ring: Keyring,
) {
  const e = envelope.parse(encoded);
  const key = ring.keys[e.keyId];
  if (!key) throw new Error("webhook_key_unavailable");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(e.iv, "base64"),
  );
  decipher.setAAD(Buffer.from("futureflow:" + organizationId + ":" + sourceId));
  decipher.setAuthTag(Buffer.from(e.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(e.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
export function signature(
  secret: string,
  timestamp: string,
  eventId: string,
  body: Uint8Array,
) {
  return createHmac("sha256", secret)
    .update(timestamp + "." + eventId + ".")
    .update(body)
    .digest("hex");
}
export function verifySignature(
  secret: string,
  headers: Headers,
  body: Uint8Array,
  now = Date.now(),
) {
  const timestamp = headers.get("x-futureflow-timestamp") ?? "";
  const eventId = headers.get("x-futureflow-event-id") ?? "";
  const supplied = headers.get("x-futureflow-signature") ?? "";
  if (
    !/^\d{10}$/.test(timestamp) ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(eventId) ||
    !/^v1=[a-f0-9]{64}$/.test(supplied) ||
    Math.abs(now / 1000 - Number(timestamp)) > 300
  )
    return false;
  return timingSafeEqual(
    Buffer.from(signature(secret, timestamp, eventId, body), "hex"),
    Buffer.from(supplied.slice(3), "hex"),
  );
}
