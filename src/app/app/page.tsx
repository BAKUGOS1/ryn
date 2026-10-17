export const dynamic = "force-dynamic";
import Link from "next/link";
import { redirect } from "next/navigation";
import { session } from "@/lib/auth";
import { readEnv } from "@/lib/env";
import { Brand } from "@/components/brand";
import { CreateWorkspace, Logout } from "@/components/forms";
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  if (!readEnv()) redirect("/auth/login");
  const context = await session().catch(() => null);
  if (!context) redirect("/auth/login");
  const { data, error } = await context.db
    .from("organizations")
    .select("id,name")
    .order("created_at");
  if (error) throw new Error("Workspace list unavailable");
  if (data?.length && !(await searchParams).new)
    redirect("/app/" + data[0].id + "/overview");
  return (
    <div className="auth-page">
      <Link href="/">
        <Brand />
      </Link>
      <main id="main" className="auth-card">
        <span className="eyebrow">FIRST, A PLACE TO CALL YOURS</span>
        <h1>Create a workspace.</h1>
        <p className="muted">
          Keep your team, access and future automations together.
        </p>
        <CreateWorkspace />
        {data?.map((o) => (
          <p key={o.id}>
            <Link href={"/app/" + o.id + "/overview"}>
              Return to {o.name} →
            </Link>
          </p>
        ))}
        <Logout />
      </main>
    </div>
  );
}
