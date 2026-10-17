import { describe, it, expect } from "vitest";
import {
  organizationSchema,
  inviteSchema,
  can,
  tokenSchema,
} from "@/features/organizations/model";
import { readEnv } from "@/lib/env";
import { body } from "@/lib/http";
describe("input and permission boundaries", () => {
  it.each(["viewer", "editor"] as const)("%s cannot manage teams", (role) => {
    expect(can(role, "invite")).toBe(false);
    expect(can(role, "archive")).toBe(false);
  });
  it("allows editor workflow edits, owner archive, admin settings", () => {
    expect(can("editor", "edit")).toBe(true);
    expect(can("viewer", "edit")).toBe(false);
    expect(can("owner", "archive")).toBe(true);
    expect(can("admin", "settings")).toBe(true);
  });
  it("rejects role/plan injection and unsafe workspace slugs", () => {
    expect(
      organizationSchema.safeParse({
        name: "Team",
        slug: "team",
        role: "owner",
      }).success,
    ).toBe(false);
    expect(
      organizationSchema.safeParse({ name: "Team", slug: "../../admin" })
        .success,
    ).toBe(false);
    expect(
      inviteSchema.safeParse({ email: "a@b.com", role: "owner" }).success,
    ).toBe(false);
  });
  it("normalizes email and enforces token shape", () => {
    expect(inviteSchema.parse({ email: "A@B.com", role: "viewer" }).email).toBe(
      "a@b.com",
    );
    expect(tokenSchema.safeParse({ token: "guess" }).success).toBe(false);
  });
  it("fails closed for missing, placeholder or unsafe config", () => {
    expect(readEnv({})).toBeNull();
    expect(
      readEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_replace_me",
        APP_ORIGIN: "http://localhost:4173",
      }),
    ).toBeNull();
    expect(
      readEnv({
        NEXT_PUBLIC_SUPABASE_URL: "http://example.com",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "x".repeat(30),
        APP_ORIGIN: "https://app.example.com",
      }),
    ).toBeNull();
  });
  it("bounds actual body bytes without trusting Content-Length", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ x: "a".repeat(9000) }),
    });
    await expect(body(req, organizationSchema)).rejects.toMatchObject({
      status: 413,
    });
  });
});
