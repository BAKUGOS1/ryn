import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { session } from "@/lib/auth";
import { readEnv } from "@/lib/env";
import { body, checkOrigin, failure, HttpError, json } from "@/lib/http";
const credentials = z
  .object({ email: z.email().max(254), password: z.string().min(12).max(128) })
  .strict();
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(request);
    const { action } = await params;
    const db = await createClient();
    const env = readEnv()!;
    if (action === "logout") {
      const { error } = await db.auth.signOut();
      if (error) throw new HttpError(502, "Sign out failed. Please retry.");
      return json({ ok: true });
    }
    if (action === "reset") {
      const { email } = await body(
        request,
        z.object({ email: z.email().max(254) }).strict(),
      );
      await db.auth.resetPasswordForEmail(email, {
        redirectTo: env.origin + "/auth/callback?next=/auth/update",
      });
      return json({
        message: "If an account exists, a reset link will arrive shortly.",
      });
    }
    if (action === "update") {
      await session();
      const { password } = await body(
        request,
        z.object({ password: z.string().min(12).max(128) }).strict(),
      );
      const { error } = await db.auth.updateUser({ password });
      if (error)
        throw new HttpError(
          400,
          "Password could not be updated. Request a new reset link.",
        );
      return json({ ok: true });
    }
    if (action !== "login" && action !== "signup")
      throw new HttpError(404, "Action not found.");
    const input = await body(request, credentials);
    if (action === "signup") {
      const { error } = await db.auth.signUp({
        ...input,
        options: { emailRedirectTo: env.origin + "/auth/callback" },
      });
      if (error)
        throw new HttpError(
          400,
          "Account could not be created. Check your entries or try later.",
        );
      return json({
        message: "Check your email to confirm your account, then sign in.",
      });
    }
    const { error } = await db.auth.signInWithPassword(input);
    if (error)
      throw new HttpError(
        401,
        "Unable to sign in. Check your credentials and email confirmation.",
      );
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
