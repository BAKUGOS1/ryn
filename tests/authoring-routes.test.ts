import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  maybeSingle: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mock.getUser },
    from: mock.from,
    rpc: mock.rpc,
  }),
}));
import { POST as create } from "@/app/api/automations/route";
import { POST as mutate } from "@/app/api/automations/[id]/[action]/route";
const org = "10000000-0000-4000-8000-000000000001";
const workflow = "10000000-0000-4000-8000-000000000002";
const definition = {
  schemaVersion: 1,
  name: "Test deadline",
  trigger: {
    type: "deadline.once",
    config: { at: "2027-01-20T09:00:00Z", timezone: "UTC", leadMinutes: 60 },
  },
  nodes: [
    {
      id: "record",
      type: "action",
      config: { provider: "internal", operation: "audit_record" },
    },
  ],
  edges: [],
};
function request(payload: unknown, origin = "https://app.example.com") {
  return new Request(origin + "/api/automations", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}
function action(name: string, payload: unknown) {
  return mutate(request(payload), {
    params: Promise.resolve({ id: workflow, action: name }),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_test_not_real_0000",
  );
  vi.stubEnv("APP_ORIGIN", "https://app.example.com");
  vi.stubEnv("AUTOMATION_ENABLED", "false");
  vi.stubEnv("MONITORING_ENABLED", "false");
  mock.getUser.mockResolvedValue({
    data: {
      user: { id: org, email_confirmed_at: "2026-01-01", is_anonymous: false },
    },
    error: null,
  });
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: mock.maybeSingle,
  };
  mock.from.mockReturnValue(query);
  mock.maybeSingle.mockResolvedValue({ data: { role: "owner" }, error: null });
  mock.rpc.mockResolvedValue({ data: 2, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("denies unverified onboarding identities before membership or authoring calls", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: org, email_confirmed_at: null } },
    error: null,
  });
  expect(
    (await create(request({ organizationId: org, definition }))).status,
  ).toBe(401);
  expect(mock.from).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
it.each([null, { role: "viewer" }])(
  "denies non-members/viewers before saving",
  async (membership) => {
    mock.maybeSingle.mockResolvedValue({ data: membership, error: null });
    expect(
      (await action("save", { organizationId: org, definition, revision: 1 }))
        .status,
    ).toBe(403);
    expect(mock.rpc).not.toHaveBeenCalled();
  },
);
it("permits an editor to save an authorized validated draft while execution is disabled", async () => {
  mock.maybeSingle.mockResolvedValue({ data: { role: "editor" }, error: null });
  const response = await action("save", {
    organizationId: org,
    definition,
    revision: 1,
  });
  expect(response.status).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("save_workflow", {
    p_org: org,
    p_workflow: workflow,
    p_revision: 1,
    p_definition: definition,
  });
  expect(await response.json()).toMatchObject({ result: 2 });
});
it("rejects editor webhook-source creation before generating or saving a secret", async () => {
  mock.maybeSingle.mockResolvedValue({ data: { role: "editor" }, error: null });
  const webhook = {
    ...definition,
    trigger: { type: "webhook.signed", config: {} },
  };
  expect(
    (await create(request({ organizationId: org, definition: webhook })))
      .status,
  ).toBe(403);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("blocks publish/resume without execution configuration but still permits pause", async () => {
  expect(
    (await action("publish", { organizationId: org, revision: 1 })).status,
  ).toBe(503);
  expect(
    (await action("state", { organizationId: org, state: "active" })).status,
  ).toBe(503);
  expect(mock.rpc).not.toHaveBeenCalled();
  expect(
    (await action("state", { organizationId: org, state: "paused" })).status,
  ).toBe(200);
  expect(mock.rpc).toHaveBeenCalledWith("set_workflow_state", {
    p_org: org,
    p_workflow: workflow,
    p_state: "paused",
  });
});
it("returns a conflict for stale drafts without exposing database error text", async () => {
  mock.rpc.mockResolvedValue({
    data: null,
    error: { code: "FF003", message: "private SQL details" },
  });
  const response = await action("save", {
    organizationId: org,
    definition,
    revision: 1,
  });
  expect(response.status).toBe(409);
  expect(await response.text()).not.toContain("private SQL details");
});
it("rejects forged role and unknown workflow operations", async () => {
  expect(
    (
      await action("save", {
        organizationId: org,
        definition,
        revision: 1,
        role: "owner",
      })
    ).status,
  ).toBe(400);
  expect(
    (await action("execute-arbitrary-code", { organizationId: org })).status,
  ).toBe(404);
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("rejects a foreign origin before consulting identity or the database", async () => {
  expect(
    (
      await create(
        request({ organizationId: org, definition }, "https://evil.example"),
      )
    ).status,
  ).toBe(403);
  expect(mock.getUser).not.toHaveBeenCalled();
  expect(mock.rpc).not.toHaveBeenCalled();
});
