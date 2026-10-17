import { afterEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
afterEach(() => vi.unstubAllEnvs());
it("disables the worker endpoint when provider configuration is missing", async () => {
  vi.stubEnv("MONITORING_ENABLED", "false");
  const { POST } = await import("@/app/api/inngest/route");
  const response = await POST(
    new NextRequest("https://example.com/api/inngest", {
      method: "POST",
      body: "{}",
    }),
  );
  expect(response.status).toBe(503);
});
it("rejects unsigned worker invocations even with configured providers", async () => {
  vi.resetModules();
  for (const [name, value] of Object.entries({
    MONITORING_ENABLED: "true",
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_not_real_0000000000000",
    INNGEST_SIGNING_KEY: "signkey-test-" + "a".repeat(64),
    INNGEST_EVENT_KEY: "not-real-event-key-00000000",
    RESEND_API_KEY: "not-real-resend-key",
    ALERT_FROM_EMAIL: "alerts@example.com",
    MONITOR_ALLOWED_HOSTS: "example.com",
  }))
    vi.stubEnv(name, value);
  const { POST } = await import("@/app/api/inngest/route");
  const response = await POST(
    new NextRequest(
      "https://example.com/api/inngest?fnId=monitor-probe&stepId=step",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      },
    ),
  );
  expect([400, 401, 403]).toContain(response.status);
});
