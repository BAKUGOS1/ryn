import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";
export default function robots(): MetadataRoute.Robots {
  const { origin, indexable } = siteConfig();
  return indexable
    ? {
        rules: {
          userAgent: "*",
          allow: "/",
          disallow: ["/api/", "/app", "/auth/", "/invite", "/preview"],
        },
        sitemap: origin + "/sitemap.xml",
      }
    : { rules: { userAgent: "*", disallow: "/" } };
}
