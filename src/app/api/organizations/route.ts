import { session } from "@/lib/auth";
import { body, checkOrigin, dbError, failure, json } from "@/lib/http";
import { organizationSchema } from "@/features/organizations/model";
export async function GET() {
  try {
    const { db } = await session();
    const { data, error } = await db
      .from("organizations")
      .select("*")
      .order("created_at");
    dbError(error);
    return json({ organizations: data });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const input = await body(request, organizationSchema);
    const { db } = await session();
    const { data, error } = await db.rpc("create_organization", {
      p_name: input.name,
      p_slug: input.slug,
    });
    dbError(error);
    return json({ id: data }, 201);
  } catch (e) {
    return failure(e);
  }
}
