import { it, expect, vi } from "vitest";
import {
  publicAddress,
  targetUrl,
  resolveTarget,
  probe,
  UnsafeTarget,
} from "@/features/monitoring/safe-http";
import { sendEmail, withinRetryWindow } from "@/features/monitoring/email";
import { monitoringEnv } from "@/features/monitoring/runtime";
it.each([
  "127.0.0.1",
  "10.2.3.4",
  "172.16.0.1",
  "192.168.1.1",
  "169.254.169.254",
  "100.64.0.1",
  "0.0.0.0",
  "224.0.0.1",
  "::1",
  "fe80::1",
  "fc00::1",
  "::ffff:127.0.0.1",
  "2001:db8::1",
])("blocks non-public address %s", (ip) =>
  expect(publicAddress(ip)).toBe(false),
);
it.each(["93.184.216.34", "2606:4700:4700::1111"])(
  "permits public unicast %s",
  (ip) => expect(publicAddress(ip)).toBe(true),
);
it.each([
  "http://example.com/",
  "https://user:pass@example.com/",
  "https://example.com:8443/",
  "https://example.com/?token=secret",
  "https://example.com/#secret",
  "https://example.com./",
  "https://evil.example/",
  "https://127.1/",
  "https://2130706433/",
  "https://[::1]/",
])("rejects unsafe or unapproved URL %s", (url) => {
  expect(() => targetUrl(url, ["example.com"])).toThrow(UnsafeTarget);
});
it("rejects mixed public/private DNS and revalidates every connection", async () => {
  const resolve = vi
    .fn()
    .mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
    .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
  const wire = vi.fn().mockResolvedValue({ statusCode: 200 });
  expect(
    (await probe("https://example.com/", ["example.com"], { resolve, wire }))
      .outcome,
  ).toBe("healthy");
  expect(
    (await probe("https://example.com/", ["example.com"], { resolve, wire }))
      .outcome,
  ).toBe("blocked");
  expect(wire).toHaveBeenCalledTimes(1);
  await expect(
    resolveTarget(new URL("https://example.com"), async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]),
  ).rejects.toBeInstanceOf(UnsafeTarget);
});
it("passes the validated address to the socket adapter and never follows redirects", async () => {
  const wire = vi.fn().mockResolvedValue({ statusCode: 302 });
  const result = await probe("https://example.com/health", ["example.com"], {
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    wire,
  });
  expect(result.outcome).toBe("unhealthy");
  expect(wire).toHaveBeenCalledTimes(1);
  expect(wire.mock.calls[0][0]).toMatchObject({
    address: "93.184.216.34",
    family: 4,
    timeoutMs: 10000,
    maxBytes: 65536,
  });
});
it("classifies timeout and network failure without leaking the URL or exception", async () => {
  const opts = {
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    wire: async () => {
      throw new Error("probe_timeout");
    },
  };
  expect(
    await probe("https://example.com/", ["example.com"], opts),
  ).toMatchObject({ outcome: "timeout", statusCode: null });
  const result = await probe("https://example.com/", ["example.com"], {
    ...opts,
    wire: async () => {
      throw new Error("provider secret");
    },
  });
  expect(result.outcome).toBe("network");
  expect(JSON.stringify(result)).not.toContain("secret");
});
it("uses a stable provider idempotency key and exact payload across retries", async () => {
  const calls: RequestInit[] = [];
  const send = vi.fn(async (_url: unknown, options?: RequestInit) => {
    calls.push(options!);
    return new Response(JSON.stringify({ id: "email-1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const input = {
    id: "delivery-id",
    to: "a@example.com",
    subject: "Portal is down",
    text: "Inspect the workspace.",
    firstAttemptAt: new Date().toISOString(),
  };
  for (let i = 0; i < 2; i++)
    expect(
      await sendEmail(
        input,
        { apiKey: "not-a-real-key", from: "alerts@example.com" },
        send,
      ),
    ).toBe("email-1");
  expect(calls[0].body).toEqual(calls[1].body);
  expect(calls[0].headers).toEqual(calls[1].headers);
  expect((calls[0].headers as Record<string, string>)["Idempotency-Key"]).toBe(
    "futureflow/delivery-id",
  );
});
it("never reissues email outside the provider deduplication window", async () => {
  const firstAttemptAt = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const send = vi.fn();
  expect(withinRetryWindow(firstAttemptAt)).toBe(false);
  await expect(
    sendEmail(
      {
        id: "id",
        to: "a@example.com",
        subject: "s",
        text: "t",
        firstAttemptAt,
      },
      { apiKey: "key", from: "alerts@example.com" },
      send,
    ),
  ).rejects.toMatchObject({ disposition: "review" });
  expect(send).not.toHaveBeenCalled();
});
it.each([
  [429, "retry"],
  [503, "retry"],
  [400, "review"],
  [401, "review"],
])("classifies provider %s as %s", async (status, disposition) => {
  const send = vi.fn(
    async () => new Response("{}", { status: Number(status) }),
  );
  await expect(
    sendEmail(
      {
        id: "id",
        to: "a@example.com",
        subject: "s",
        text: "t",
        firstAttemptAt: new Date().toISOString(),
      },
      { apiKey: "key", from: "alerts@example.com" },
      send,
    ),
  ).rejects.toMatchObject({ disposition });
});
it("disabled configuration cannot expose a live worker", () => {
  expect(monitoringEnv({})).toBeNull();
  expect(monitoringEnv({ MONITORING_ENABLED: "true" })).toBeNull();
});
