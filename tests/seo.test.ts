import { afterEach, expect, it, vi } from "vitest";
import { publicMetadata, serializeJsonLd, siteConfig } from "@/lib/seo";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
afterEach(() => vi.unstubAllEnvs());
it.each([
  undefined,
  "http://example.com",
  "https://a:b@example.com",
  "https://example.com/path",
  "https://example.com?x=1",
  "https://localhost",
  "https://127.0.0.1",
])("rejects unsuitable canonical origin %s", (APP_ORIGIN) => {
  expect(
    siteConfig({ APP_ORIGIN, SITE_INDEXING_ENABLED: "true" }).indexable,
  ).toBe(false);
});
it("requires explicit launch opt-in and excludes Vercel previews", () => {
  expect(siteConfig({ APP_ORIGIN: "https://ryn.example" }).indexable).toBe(
    false,
  );
  expect(
    siteConfig({
      APP_ORIGIN: "https://ryn.example",
      SITE_INDEXING_ENABLED: "true",
      VERCEL_ENV: "preview",
    }).indexable,
  ).toBe(false);
});
it("publishes only canonical public routes when launch is enabled", () => {
  vi.stubEnv("APP_ORIGIN", "https://ryn.example");
  vi.stubEnv("SITE_INDEXING_ENABLED", "true");
  vi.stubEnv("VERCEL_ENV", "production");
  expect(sitemap().map((entry) => entry.url)).toEqual([
    "https://ryn.example/",
    "https://ryn.example/use-cases",
    "https://ryn.example/docs",
    "https://ryn.example/security",
  ]);
  expect(publicMetadata("/docs", "Guide", "Help").robots).toEqual({
    index: true,
    follow: true,
  });
  expect(publicMetadata("/docs", "Guide", "Help").alternates?.canonical).toBe(
    "https://ryn.example/docs",
  );
  expect(robots().sitemap).toBe("https://ryn.example/sitemap.xml");
});
it("omits sitemap entries and blocks crawling before launch", () => {
  vi.stubEnv("SITE_INDEXING_ENABLED", "false");
  expect(sitemap()).toEqual([]);
  expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
});
it("escapes JSON-LD script terminators without changing the data", () => {
  const input = { name: "</script><script>alert(1)</script>" };
  const output = serializeJsonLd(input);
  expect(output).not.toContain("<");
  expect(JSON.parse(output)).toEqual(input);
});
