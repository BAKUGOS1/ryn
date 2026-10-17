import "server-only";
import { createClient } from "./supabase/server";
import { HttpError } from "./http";
import { readEnv } from "./env";
import {
  can,
  type Role,
  type Permission,
} from "@/features/organizations/model";
export async function session() {
  if (!readEnv())
    throw new HttpError(503, "Setup required. Configure Supabase to continue.");
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user || !user.email_confirmed_at || user.is_anonymous)
    throw new HttpError(401, "Sign in with a verified email to continue.");
  return { db, user };
}
export async function authorize(id: string, permission: Permission = "read") {
  const { db, user } = await session();
  const { data, error } = await db
    .from("organization_members")
    .select("role")
    .eq("organization_id", id)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data || !can(data.role as Role, permission))
    throw new HttpError(403, "Workspace access denied.");
  return { db, user, role: data.role as Role };
}
