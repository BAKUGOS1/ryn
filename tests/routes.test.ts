import { beforeEach, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mock.getUser },
    from: mock.from,
    rpc: mock.rpc,
  }),
}));
import { GET, POST } from "@/app/api/organizations/route";
import { POST as mutate } from "@/app/api/organizations/[id]/[action]/route";
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_test_not_real_0000",
  );
  vi.stubEnv("APP_ORIGIN", "https://app.example.com");
});
it("returns 401 without a verified session", async () => {
  mock.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET()).status).toBe(401);
  expect(mock.from).not.toHaveBeenCalled();
});
it("rejects cross-origin mutation before consulting auth/db", async () => {
  const response = await POST(
    new Request("https://app.example.com/api/organizations", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  expect(response.status).toBe(403);
  expect(mock.getUser).not.toHaveBeenCalled();
});
it("rejects another tenant at the server authorization boundary", async () => {
  mock.getUser.mockResolvedValue({
    data: { user: { id: "user-a", email_confirmed_at: "2026-01-01" } },
    error: null,
  });
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mock.from.mockReturnValue(chain);
  const res = await mutate(
    new Request("https://app.example.com/api/organizations/x/settings", {
      method: "POST",
      headers: {
        origin: "https://app.example.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Hacked", timezone: "UTC" }),
    }),
    {
      params: Promise.resolve({
        id: "10000000-0000-4000-8000-000000000001",
        action: "settings",
      }),
    },
  );
  expect(res.status).toBe(403);
  expect(mock.rpc).not.toHaveBeenCalled();
});
