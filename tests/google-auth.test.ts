import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: mock }),
}));
import { POST } from "@/app/auth/google/route";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_test_00000000",
  );
  vi.stubEnv("APP_ORIGIN", "https://app.example.com");
});

function request(origin = "https://app.example.com") {
  return new Request("https://app.example.com/auth/google", {
    method: "POST",
    headers: { origin },
  });
}

it("rejects cross-origin sign-in before contacting the provider", async () => {
  expect((await POST(request("https://evil.example"))).status).toBe(403);
  expect(mock.signInWithOAuth).not.toHaveBeenCalled();
});

it("keeps sign-in disabled until Supabase is configured", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  expect((await POST(request())).status).toBe(503);
  expect(mock.signInWithOAuth).not.toHaveBeenCalled();
});

it("uses the configured callback and redirects to the provider without caching", async () => {
  mock.signInWithOAuth.mockResolvedValue({
    data: { url: "https://accounts.google.com/o/oauth2/v2/auth?state=test" },
    error: null,
  });
  const response = await POST(request());
  expect(mock.signInWithOAuth).toHaveBeenCalledWith({
    provider: "google",
    options: { redirectTo: "https://app.example.com/auth/callback" },
  });
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toContain(
    "https://accounts.google.com/",
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("returns a generic sign-in error without exposing provider details", async () => {
  mock.signInWithOAuth.mockResolvedValue({
    data: { url: null },
    error: { message: "private provider detail" },
  });
  const response = await POST(request());
  expect(response.headers.get("location")).toBe(
    "https://app.example.com/auth/login?error=google",
  );
  expect(await response.text()).not.toContain("private provider detail");
});
