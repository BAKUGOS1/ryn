import "server-only";
import { createClient } from "@supabase/supabase-js";
import { monitoringEnv } from "./runtime";
export type Rpc = (
  name: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;
export function workerRepository(): Rpc {
  const env = monitoringEnv();
  if (!env) throw new Error("monitoring_not_configured");
  const db = createClient(env.url, env.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return async (name, args = {}) => {
    const { data, error } = await db.rpc(name, args);
    if (error) throw new Error("monitor_database_unavailable");
    return data;
  };
}
