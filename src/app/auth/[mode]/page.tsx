import Link from "next/link";
import { notFound } from "next/navigation";
import { Brand } from "@/components/brand";
import { AuthForm } from "@/components/auth-form";
import { readEnv } from "@/lib/env";
export default async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { mode } = await params;
  if (!["login", "signup", "reset", "update"].includes(mode)) notFound();
  const m = mode as "login" | "signup" | "reset" | "update";
  return (
    <div className="auth-page">
      <Link href="/">
        <Brand />
      </Link>
      <main id="main" className="auth-card">
        <span className="eyebrow">YOUR NEXT CHAPTER</span>
        <h1>
          {
            {
              login: "Welcome back.",
              signup: "Make room for better work.",
              reset: "Let’s get you back in.",
              update: "Choose a new password.",
            }[m]
          }
        </h1>
        <p className="muted">One account. A clear space for every team.</p>
        {(await searchParams).error && (
          <p role="alert">
            The confirmation link could not be verified. Request a new link.
          </p>
        )}
        {readEnv() ? (
          <AuthForm mode={m} />
        ) : (
          <div className="setup-note">
            <strong>Authentication is not connected</strong>
            <p>
              Configure the development Supabase project using the README.
              Sign-in stays disabled until setup is complete.
            </p>
            <Link href="/preview">Explore the workspace preview →</Link>
          </div>
        )}
      </main>
    </div>
  );
}
