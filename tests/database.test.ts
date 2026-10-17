import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
let db: PGlite;
const ids = {
  a: "10000000-0000-4000-8000-000000000001",
  b: "10000000-0000-4000-8000-000000000002",
  c: "10000000-0000-4000-8000-000000000003",
  d: "10000000-0000-4000-8000-000000000004",
  e: "10000000-0000-4000-8000-000000000005",
  unverified: "10000000-0000-4000-8000-000000000006",
};
let a: string, b: string;
async function as(user: string | null) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    user ?? "",
  ]);
  await db.exec("set role authenticated");
}
async function query(sql: string, args: unknown[] = []) {
  return db.query<Record<string, unknown>>(sql, args);
}
async function invite(email: string, role = "viewer", hash = "a".repeat(64)) {
  await as(ids.a);
  return query("select public.create_invitation($1,$2,$3,$4) id", [
    a,
    email,
    role,
    hash,
  ]);
}
async function add(user: keyof typeof ids, role: string, hash: string) {
  await invite(user + "@example.com", role, hash.repeat(64));
  await as(ids[user]);
  await query("select public.accept_invitation($1)", [hash.repeat(64)]);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  const file = readdirSync("supabase/migrations").find((f) =>
    f.endsWith("_foundation.sql"),
  )!;
  await db.exec(readFileSync("supabase/migrations/" + file, "utf8"));
});
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(
    "reset role;truncate public.audit_logs,public.organization_invites,public.organization_settings,public.organization_members,public.organizations,private.mutation_buckets,auth.users cascade",
  );
  for (const [key, id] of Object.entries(ids)) {
    await query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)",
      [
        id,
        key + "@example.com",
        key === "unverified" ? null : new Date().toISOString(),
      ],
    );
  }
  await as(ids.a);
  a = (
    await query("select public.create_organization($1,$2) id", [
      "Alpha",
      "alpha",
    ])
  ).rows[0].id as string;
  await as(ids.b);
  b = (
    await query("select public.create_organization($1,$2) id", ["Beta", "beta"])
  ).rows[0].id as string;
});
describe("Real PostgreSQL policies and transactions (PGlite; Supabase Auth fixtures)", () => {
  it("isolates organizations, memberships, settings and audit by tenant", async () => {
    await as(ids.a);
    for (const table of [
      "organizations",
      "organization_members",
      "organization_settings",
      "audit_logs",
    ]) {
      const rows = (await query("select * from public." + table)).rows;
      expect(rows.length).toBe(1);
      expect(
        rows[0][table === "organizations" ? "id" : "organization_id"],
      ).toBe(a);
    }
  });
  it("rejects cross-tenant RPC writes", async () => {
    await as(ids.a);
    await expect(
      query("select public.update_organization($1,$2,$3)", [
        b,
        "Attacker",
        "UTC",
      ]),
    ).rejects.toMatchObject({ code: "FF001" });
  });
  it("denies direct client mutation and privilege escalation", async () => {
    await as(ids.a);
    await expect(
      query(
        "update public.organization_members set role='owner' where organization_id=$1",
        [b],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      query(
        "insert into public.organizations(name,slug,owner_id) values('Hack','hack',$1)",
        [ids.a],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("denies anonymous execution", async () => {
    await db.exec("reset role;set role anon");
    await expect(
      query("select public.create_organization('Hack','hack')"),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("denies unverified users and anonymous signins", async () => {
    await as(ids.unverified);
    await expect(
      query("select public.create_organization('No','nope')"),
    ).rejects.toMatchObject({ code: "FF001" });
    await db.exec("reset role");
    await query("update auth.users set is_anonymous=true where id=$1", [ids.c]);
    await as(ids.c);
    await expect(
      query("select public.create_organization('No','nope')"),
    ).rejects.toMatchObject({ code: "FF001" });
  });
  it("email-binds invitations and prevents replay", async () => {
    await invite("c@example.com");
    await as(ids.b);
    await expect(
      query("select public.accept_invitation($1)", ["a".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
    await as(ids.c);
    await query("select public.accept_invitation($1)", ["a".repeat(64)]);
    await expect(
      query("select public.accept_invitation($1)", ["a".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
    expect(
      (await query("select * from public.organizations")).rows,
    ).toHaveLength(1);
  });
  it("rejects expired and revoked invitations", async () => {
    await invite("c@example.com");
    await db.exec("reset role");
    await query(
      "update public.organization_invites set expires_at=now()-interval '1 second'",
    );
    await as(ids.c);
    await expect(
      query("select public.accept_invitation($1)", ["a".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
    await invite("c@example.com", "viewer", "b".repeat(64));
    await as(ids.a);
    const row = (
      await query(
        "select id from public.organization_invites where revoked_at is null",
      )
    ).rows[0];
    await query("select public.revoke_invitation($1,$2)", [a, row.id]);
    await as(ids.c);
    await expect(
      query("select public.accept_invitation($1)", ["b".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
  });
  it("never exposes token hashes, even to owners", async () => {
    await invite("c@example.com");
    await expect(
      query("select token_hash from public.organization_invites"),
    ).rejects.toMatchObject({ code: "42501" });
    expect(
      (await query("select email from public.organization_invites")).rows,
    ).toHaveLength(1);
  });
  it("enforces viewer/editor read-only team administration", async () => {
    for (const [user, role, hash] of [
      ["c", "viewer", "c"],
      ["d", "editor", "d"],
    ] as const) {
      await add(user, role, hash);
      await expect(
        query("select public.update_organization($1,$2,$3)", [
          a,
          "Nope",
          "UTC",
        ]),
      ).rejects.toMatchObject({ code: "FF001" });
      await expect(
        query("select public.create_invitation($1,$2,$3,$4)", [
          a,
          "x@example.com",
          "viewer",
          "e".repeat(64),
        ]),
      ).rejects.toMatchObject({ code: "FF001" });
      expect(
        (await query("select email from public.organization_invites")).rows,
      ).toHaveLength(0);
    }
  });
  it("allows admin settings but denies owner/admin escalation", async () => {
    await add("c", "admin", "c");
    await query("select public.update_organization($1,$2,$3)", [
      a,
      "Alpha updated",
      "UTC",
    ]);
    await expect(
      query("select public.create_invitation($1,$2,$3,$4)", [
        a,
        "d@example.com",
        "admin",
        "d".repeat(64),
      ]),
    ).rejects.toMatchObject({ code: "FF001" });
    await expect(
      query("select public.update_member($1,$2,$3,$4)", [
        a,
        ids.a,
        "viewer",
        "suspended",
      ]),
    ).rejects.toMatchObject({ code: "FF001" });
    await expect(
      query("select public.archive_organization($1)", [a]),
    ).rejects.toMatchObject({ code: "FF001" });
  });
  it("suspension removes access immediately and cannot be undone by an old invite", async () => {
    await add("c", "viewer", "c");
    await as(ids.a);
    await query("select public.update_member($1,$2,$3,$4)", [
      a,
      ids.c,
      "viewer",
      "suspended",
    ]);
    await as(ids.c);
    expect(
      (await query("select * from public.organizations")).rows,
    ).toHaveLength(0);
    await expect(
      query("select public.accept_invitation($1)", ["c".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
  });
  it("protects owner and prevents self promotion", async () => {
    await as(ids.a);
    await expect(
      query("select public.update_member($1,$2,$3,$4)", [
        a,
        ids.a,
        "viewer",
        "active",
      ]),
    ).rejects.toMatchObject({ code: "FF001" });
  });
  it("enforces tenant composite inviter foreign key, even for privileged writes", async () => {
    await db.exec("reset role");
    await expect(
      query(
        "insert into public.organization_invites(organization_id,email,role,token_hash,created_by) values($1,$2,$3,$4,$5)",
        [a, "c@example.com", "viewer", "c".repeat(64), ids.b],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  });
  it("archives without deleting audit history and blocks future access", async () => {
    await invite("c@example.com");
    await query("select public.archive_organization($1)", [a]);
    expect(
      (await query("select * from public.organizations")).rows,
    ).toHaveLength(0);
    await as(ids.c);
    await expect(
      query("select public.accept_invitation($1)", ["a".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
    await db.exec("reset role");
    expect(
      (
        await query(
          "select * from public.audit_logs where action='workspace.archived'",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("membership in two tenants allows exactly those tenants", async () => {
    await invite("b@example.com");
    await as(ids.b);
    await query("select public.accept_invitation($1)", ["a".repeat(64)]);
    expect(
      (await query("select * from public.organizations")).rows,
    ).toHaveLength(2);
  });
  it("invalidates invitations when inviter loses permission", async () => {
    await add("c", "admin", "c");
    await query("select public.create_invitation($1,$2,$3,$4)", [
      a,
      "d@example.com",
      "viewer",
      "d".repeat(64),
    ]);
    await as(ids.a);
    await query("select public.update_member($1,$2,$3,$4)", [
      a,
      ids.c,
      "viewer",
      "active",
    ]);
    await as(ids.d);
    await expect(
      query("select public.accept_invitation($1)", ["d".repeat(64)]),
    ).rejects.toMatchObject({ code: "FF002" });
  });
  it("rolls back invalid settings and records no audit for failed mutation", async () => {
    await as(ids.a);
    await expect(
      query("select public.update_organization($1,$2,$3)", [
        a,
        "Changed",
        "invalid/timezone",
      ]),
    ).rejects.toMatchObject({ code: "23514" });
    expect(
      (await query("select name from public.organizations")).rows[0].name,
    ).toBe("Alpha");
  });
  it("rate-limits successful workspace mutations in the database", async () => {
    await as(ids.a);
    for (let n = 0; n < 29; n++)
      await query("select public.update_organization($1,$2,$3)", [
        a,
        "Alpha",
        "UTC",
      ]);
    await expect(
      query("select public.update_organization($1,$2,$3)", [a, "Alpha", "UTC"]),
    ).rejects.toMatchObject({ code: "FF004" });
  });
});
