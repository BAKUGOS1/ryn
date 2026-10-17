import { afterEach, expect, it, vi } from "vitest";
import { post } from "@/lib/client-api";
afterEach(() => vi.unstubAllGlobals());
it("preserves actionable conflict status and server message", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "Draft changed" }, { status: 409 }),
      ),
  );
  await expect(post("/api/automations/id/save", {})).rejects.toMatchObject({
    status: 409,
    message: "Draft changed",
  });
});
it("handles an HTML gateway failure without exposing parser errors or retrying a mutation", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response("<html>Upstream outage</html>", { status: 502 }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(post("/api/organizations", {})).rejects.toMatchObject({
    status: 502,
    message: expect.stringContaining("saved state"),
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("treats an interrupted connection as an unknown mutation outcome", async () => {
  const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
  vi.stubGlobal("fetch", fetcher);
  await expect(post("/api/organizations", {})).rejects.toMatchObject({
    status: 0,
    message: expect.stringContaining("saved state"),
  });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it.each([null, [], "success"])(
  "rejects invalid success bodies (%s)",
  async (body) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    await expect(post("/api/organizations", {})).rejects.toThrow(
      "Unexpected response",
    );
  },
);
