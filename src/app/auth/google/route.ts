import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { readEnv } from "@/lib/env";
import { checkOrigin, failure } from "@/lib/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const env = readEnv()!;
    const db = await createClient();
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: env.origin + "/auth/callback" },
    });
    const response = NextResponse.redirect(
      !error && data.url ? data.url : env.origin + "/auth/login?error=google",
      303,
    );
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return failure(error);
  }
}
