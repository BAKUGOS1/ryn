import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import type { Rpc } from "@/features/monitoring/repository";
export const users = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  viewer: "10000000-0000-4000-8000-000000000003",
};
export async function harness() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon,service_role;`,
  );
  for (const file of readdirSync("supabase/migrations")
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
  const query = (sql: string, args: unknown[] = []) =>
    db.query<Record<string, unknown>>(sql, args);
  async function as(user: string) {
    await db.exec("reset role");
    await query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
    await db.exec("set role authenticated");
  }
  async function admin(sql: string, args: unknown[] = []) {
    await db.exec("reset role");
    return query(sql, args);
  }
  const rpc: Rpc = async (name, args = {}) => {
    if (
      !/^[a-z_]+$/.test(name) ||
      Object.keys(args).some((k) => !/^p_[a-z_]+$/.test(k))
    )
      throw new Error("invalid_rpc_name");
    await db.exec("reset role;set role service_role");
    const result = await query(
      "select public." +
        name +
        "(" +
        Object.keys(args)
          .map((key, i) => key + "=> $" + (i + 1))
          .join(",") +
        ") result",
      Object.values(args).map((v) =>
        typeof v === "object" && v !== null ? JSON.stringify(v) : v,
      ),
    );
    return result.rows[0].result;
  };
  async function reset() {
    await admin("truncate public.organizations,auth.users cascade");
    for (const [name, id] of Object.entries(users))
      await admin("insert into auth.users values($1,$2,now(),false)", [
        id,
        name + "@example.com",
      ]);
    await as(users.a);
    const a = (
      await query("select public.create_organization('Alpha','alpha') id")
    ).rows[0].id as string;
    await as(users.b);
    const b = (
      await query("select public.create_organization('Beta','beta') id")
    ).rows[0].id as string;
    await as(users.a);
    const monitor = (
      await query("select public.create_monitor($1,$2,$3,$4,$5) id", [
        a,
        "Portal",
        "https://example.com/health",
        15,
        users.a,
      ])
    ).rows[0].id as string;
    await query("select public.set_monitor_state($1,$2,$3)", [
      a,
      monitor,
      "active",
    ]);
    return { a, b, monitor };
  }
  async function due(org: string, monitor: string) {
    await admin(
      "update public.monitors set next_run_at=now()-interval '1 second' where id=$1 and organization_id=$2",
      [monitor, org],
    );
    await admin(
      "update private.monitor_host_leases set last_started_at=now()-interval '2 seconds'",
    );
    await rpc("dispatch_monitors");
    return (
      await admin(
        "select id from public.probe_jobs where organization_id=$1 and monitor_id=$2 and state='queued' order by scheduled_at desc limit 1",
        [org, monitor],
      )
    ).rows[0].id as string;
  }
  return { db, query, as, admin, rpc, reset, due };
}
