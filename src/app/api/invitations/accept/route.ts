import { createHash } from "node:crypto";
import { session } from "@/lib/auth";
import { body, checkOrigin, dbError, failure, json } from "@/lib/http";
import { tokenSchema } from "@/features/organizations/model";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const { token } = await body(request, tokenSchema);
    const { db } = await session();
    const { data, error } = await db.rpc("accept_invitation", {
      p_hash: createHash("sha256").update(token).digest("hex"),
    });
    dbError(error);
    return json({ id: data });
  } catch (e) {
    return failure(e);
  }
}
