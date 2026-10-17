import type { Metadata } from "next";
export const publicPaths = ["/", "/use-cases", "/docs", "/security"] as const;
export const siteDescription =
  "Ryn helps small teams monitor websites, route signed webhook events and track deadlines with traceable automation workflows.";
export function siteConfig(
  env: Record<string, string | undefined> = process.env,
) {
  let origin: string | undefined;
  try {
    const url = new URL(env.APP_ORIGIN ?? "");
    if (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === "/" &&
      url.hostname.includes(".") &&
      !url.hostname.endsWith(".localhost") &&
      url.hostname !== "127.0.0.1"
    )
      origin = url.origin;
  } catch {
    /* Missing origin must never produce a guessed canonical URL. */
  }
  return {
    origin,
    indexable:
      !!origin &&
      env.SITE_INDEXING_ENABLED === "true" &&
      (!env.VERCEL_ENV || env.VERCEL_ENV === "production"),
  };
}
export function publicMetadata(
  path: (typeof publicPaths)[number],
  title: string,
  description: string,
): Metadata {
  const { origin, indexable } = siteConfig();
  return {
    title,
    description,
    robots: { index: indexable, follow: indexable },
    ...(origin ? { alternates: { canonical: origin + path } } : {}),
    openGraph: {
      title,
      description,
      siteName: "Ryn",
      type: "website",
      locale: "en_IN",
      ...(origin ? { url: origin + path } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
