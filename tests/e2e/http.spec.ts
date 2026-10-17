import { test, expect } from "@playwright/test";
// HTTP E2E against a running Next.js app without credentials. No browser mocks.
test("landing and original dashboard render", async ({ request }) => {
  const landing = await request.get("/");
  expect(landing.status()).toBe(200);
  expect(await landing.text()).toContain("Less watching.");
  const preview = await request.get("/preview");
  expect(preview.status()).toBe(200);
  expect(await preview.text()).toContain("Your workspace, in focus.");
  expect(await preview.text()).toContain("No live data or connected services");
});
test("unconfigured application fails closed", async ({ request }) => {
  const response = await request.get("/api/organizations");
  expect(response.status()).toBe(503);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const page = await request.get("/app", { maxRedirects: 0 });
  expect(page.status()).toBe(307);
  expect(page.headers().location).toBe("/auth/login");
});
test("mutations cannot run without config", async ({ request }) => {
  const response = await request.post("/api/organizations", {
    data: { name: "Attack", slug: "attack" },
  });
  expect(response.status()).toBe(503);
});
test("headers prevent framing and referrer leakage", async ({ request }) => {
  const response = await request.get("/invite");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
});

test("public pages render metadata and private surfaces stay noindex", async ({
  request,
}) => {
  for (const path of ["/", "/docs", "/security", "/use-cases"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('property="og:title"');
  }
  for (const path of [
    "/preview",
    "/auth/login",
    "/invite",
    "/api/organizations",
  ]) {
    expect((await request.get(path)).headers()["x-robots-tag"]).toBe(
      "noindex, nofollow",
    );
  }
  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Disallow: /",
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "<loc>",
  );
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
});
