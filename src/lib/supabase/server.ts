import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { readEnv } from "@/lib/env";
export async function createClient() {
  const env = readEnv();
  if (!env) throw new Error("SUPABASE_NOT_CONFIGURED");
  const store = await cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values)
            store.set(name, value, options);
        } catch {
          /* Server Components cannot write; proxy owns refresh. */
        }
      },
    },
  });
}
