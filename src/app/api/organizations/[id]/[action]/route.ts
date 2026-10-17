import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { authorize } from "@/lib/auth";
import {
  body,
  checkOrigin,
  dbError,
  failure,
  HttpError,
  json,
} from "@/lib/http";
import {
  idSchema,
  inviteSchema,
  memberSchema,
  settingsSchema,
  type Permission,
} from "@/features/organizations/model";
type Context = { params: Promise<{ id: string; action: string }> };
export async function POST(request: Request, context: Context) {
  try {
    checkOrigin(request);
    const { id, action } = await context.params;
    if (!idSchema.safeParse(id).success)
      throw new HttpError(400, "Invalid workspace.");
    const permissions: Record<string, Permission> = {
      settings: "settings",
      invite: "invite",
      member: "members",
      revoke: "invite",
      archive: "archive",
    };
    const permission = permissions[action];
    if (!permission) throw new HttpError(404, "Action not found.");
    const { db, role } = await authorize(id, permission);
    if (action === "settings") {
      const v = await body(request, settingsSchema);
      const { error } = await db.rpc("update_organization", {
        p_org: id,
        p_name: v.name,
        p_timezone: v.timezone,
      });
      dbError(error);
    }
    if (action === "archive") {
      const v = await body(
        request,
        z.object({ confirmation: z.literal("ARCHIVE") }).strict(),
      );
      if (v.confirmation) {
        const { error } = await db.rpc("archive_organization", { p_org: id });
        dbError(error);
      }
    }
    if (action === "invite") {
      const v = await body(request, inviteSchema);
      if (v.role === "admin" && role !== "owner")
        throw new HttpError(403, "Only an owner can invite an admin.");
      const token = randomBytes(32).toString("hex");
      const hash = createHash("sha256").update(token).digest("hex");
      const { error } = await db.rpc("create_invitation", {
        p_org: id,
        p_email: v.email,
        p_role: v.role,
        p_hash: hash,
      });
      dbError(error);
      return json({ token }, 201);
    }
    if (action === "member") {
      const v = await body(request, memberSchema);
      const { error } = await db.rpc("update_member", {
        p_org: id,
        p_user: v.userId,
        p_role: v.role,
        p_status: v.status,
      });
      dbError(error);
    }
    if (action === "revoke") {
      const v = await body(request, z.object({ inviteId: z.uuid() }).strict());
      const { error } = await db.rpc("revoke_invitation", {
        p_org: id,
        p_invite: v.inviteId,
      });
      dbError(error);
    }
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
