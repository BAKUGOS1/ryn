/** Local, disposable PostgreSQL fixtures only. Never contacts hosted Supabase. */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;`,
);
for (const migration of readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort())
  await db.exec(readFileSync("supabase/migrations/" + migration, "utf8"));
for (const [index, name] of ["alpha", "beta"].entries()) {
  const id = `10000000-0000-4000-8000-00000000000${index + 1}`;
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())",
    [id, `${name}@example.com`],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
  await db.query("select public.create_organization($1,$2)", [
    name.toUpperCase(),
    name,
  ]);
  await db.exec("reset role");
}
console.log(
  "Seed validated:",
  (await db.query("select name,slug from public.organizations order by slug"))
    .rows,
);
console.log("Disposable fixture database only; no hosted users created.");
await db.close();
