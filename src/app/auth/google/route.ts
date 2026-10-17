import { createClient } from "@/lib/supabase/server";
import { readEnv } from "@/lib/env";
import { checkOrigin, failure, HttpError, json } from "@/lib/http";

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const env = readEnv()!;
    const db = await createClient();
    const { data, error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: env.origin + "/auth/callback" },
    });
    if (error || !data.url)
      throw new HttpError(
        502,
        "Google sign-in could not be started. Please try again.",
      );
    return json({ url: data.url });
  } catch (error) {
    return failure(error);
  }
}
