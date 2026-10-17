import { it, expect } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  readKeyring,
  signature,
  verifySignature,
  newSigningSecret,
} from "@/features/automations/webhook-security";
const ring = {
  active: "a",
  keys: { a: Buffer.alloc(32, 1), b: Buffer.alloc(32, 2) },
};
it("encrypts secrets with authenticated tenant/source binding and supports key rotation", () => {
  const secret = newSigningSecret();
  const e = encryptSecret(secret, "org", "source", ring);
  expect(JSON.stringify(e)).not.toContain(secret);
  expect(decryptSecret(e, "org", "source", { ...ring, active: "b" })).toBe(
    secret,
  );
  expect(() => decryptSecret(e, "other", "source", ring)).toThrow();
  expect(() =>
    decryptSecret(
      { ...e, tag: Buffer.alloc(16).toString("base64") },
      "org",
      "source",
      ring,
    ),
  ).toThrow();
  expect(() =>
    decryptSecret(e, "org", "source", {
      active: "b",
      keys: { b: ring.keys.b },
    }),
  ).toThrow();
});
it("fails closed on incomplete keyrings", () => {
  expect(readKeyring({})).toBeNull();
  expect(
    readKeyring({
      WEBHOOK_ACTIVE_KEY_ID: "a",
      WEBHOOK_ENCRYPTION_KEYS: '{"a":"short"}',
    }),
  ).toBeNull();
  expect(
    readKeyring({
      WEBHOOK_ACTIVE_KEY_ID: "a",
      WEBHOOK_ENCRYPTION_KEYS: JSON.stringify({
        a: ring.keys.a.toString("base64"),
      }),
    })?.active,
  ).toBe("a");
});
it("authenticates exact bytes, timestamp and id within a bounded replay window", () => {
  const bytes = Buffer.from('{"x":1}');
  const timestamp = "1792230000";
  const headers = new Headers({
    "x-futureflow-timestamp": timestamp,
    "x-futureflow-event-id": "event_1",
    "x-futureflow-signature":
      "v1=" + signature("secret", timestamp, "event_1", bytes),
  });
  const now = Number(timestamp) * 1000;
  expect(verifySignature("secret", headers, bytes, now)).toBe(true);
  expect(verifySignature("secret", headers, Buffer.from('{"x": 1}'), now)).toBe(
    false,
  );
  expect(verifySignature("secret", headers, bytes, now + 301000)).toBe(false);
  headers.set("x-futureflow-event-id", "event_2");
  expect(verifySignature("secret", headers, bytes, now)).toBe(false);
  headers.set("x-futureflow-signature", "v1=bad");
  expect(verifySignature("secret", headers, bytes, now)).toBe(false);
});
