import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readEnv } from "@/lib/env";
export async function GET(request: Request) {
  const env = readEnv();
  if (!env) return new Response("Setup required", { status: 503 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const db = await createClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        env.origin +
          (url.searchParams.get("next") === "/auth/update"
            ? "/auth/update"
            : "/app"),
      );
  }
  return NextResponse.redirect(env.origin + "/auth/login?error=confirmation");
}
