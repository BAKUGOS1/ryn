import type { MetadataRoute } from "next";
import { publicPaths, siteConfig } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const { origin, indexable } = siteConfig();
  return indexable ? publicPaths.map((path) => ({ url: origin + path })) : [];
}
