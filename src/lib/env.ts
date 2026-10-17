import { z } from "zod";
const schema = z.object({
  url: z.url(),
  key: z.string().min(20).startsWith("sb_publishable_"),
  origin: z.url(),
});
export function readEnv(
  source: Record<string, string | undefined> = process.env,
) {
  const parsed = schema.safeParse({
    url: source.NEXT_PUBLIC_SUPABASE_URL,
    key: source.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    origin: source.APP_ORIGIN,
  });
  if (!parsed.success) return null;
  const { url, origin, key } = parsed.data;
  if (key.includes("replace_me") || url.includes("your-project")) return null;
  for (const address of [url, origin]) {
    const u = new URL(address);
    if (u.username || u.password || u.search || u.hash || u.pathname !== "/")
      return null;
    if (
      u.protocol !== "https:" &&
      !(
        u.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(u.hostname)
      )
    )
      return null;
  }
  return { url, key, origin: new URL(origin).origin };
}
