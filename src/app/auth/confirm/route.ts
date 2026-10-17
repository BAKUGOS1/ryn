import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readEnv } from "@/lib/env";
export async function GET(request: Request) {
  const env = readEnv();
  if (!env) return new Response("Setup required", { status: 503 });
  const url = new URL(request.url);
  const token_hash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (token_hash && (type === "email" || type === "recovery")) {
    const db = await createClient();
    const { error } = await db.auth.verifyOtp({ token_hash, type });
    if (!error)
      return NextResponse.redirect(
        env.origin + (type === "recovery" ? "/auth/update" : "/app"),
      );
  }
  return NextResponse.redirect(env.origin + "/auth/login?error=confirmation");
}
