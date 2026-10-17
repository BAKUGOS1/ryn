import { z } from "zod";
export const roleSchema = z.enum(["owner", "admin", "editor", "viewer"]);
export type Role = z.infer<typeof roleSchema>;
export const organizationSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z
      .string()
      .min(3)
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();
export const settingsSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid timezone"),
  })
  .strict();
export const inviteSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    role: z.enum(["admin", "editor", "viewer"]),
  })
  .strict();
export const memberSchema = z
  .object({
    userId: z.uuid(),
    role: z.enum(["admin", "editor", "viewer"]),
    status: z.enum(["active", "suspended"]),
  })
  .strict();
export const tokenSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const idSchema = z.uuid();
export type Permission =
  "read" | "settings" | "invite" | "members" | "archive" | "edit";
const rules: Record<Role, readonly Permission[]> = {
  owner: ["read", "settings", "invite", "members", "archive", "edit"],
  admin: ["read", "settings", "invite", "members", "edit"],
  editor: ["read", "edit"],
  viewer: ["read"],
};
export function can(role: Role, permission: Permission) {
  return rules[role]?.includes(permission) ?? false;
}
export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  owner_id: string;
  archived_at: string | null;
}
export interface Membership {
  organization_id: string;
  user_id: string;
  email: string;
  role: Role;
  status: "active" | "suspended";
  joined_at: string;
}
