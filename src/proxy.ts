import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { readEnv } from "@/lib/env";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = readEnv();
  if (env) {
    const client = createServerClient(env.url, env.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          for (const c of values) request.cookies.set(c.name, c.value);
          response = NextResponse.next({ request });
          for (const c of values)
            response.cookies.set(c.name, c.value, c.options);
        },
      },
    });
    await client.auth.getClaims();
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: ["/app/:path*", "/api/:path*", "/auth/:path*", "/invite"],
};
