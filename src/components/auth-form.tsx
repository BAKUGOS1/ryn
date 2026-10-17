"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActionForm } from "./forms";
import { Button } from "./ui/button";
export function AuthForm({
  mode,
}: {
  mode: "login" | "signup" | "reset" | "update";
}) {
  const router = useRouter();
  return (
    <>
      {(mode === "login" || mode === "signup") && (
        <form action="/auth/google" method="post" className="form-stack">
          <Button type="submit" variant="secondary">
            Continue with Google
          </Button>
          <p className="muted">Or continue with your email</p>
        </form>
      )}
      <ActionForm
        endpoint={"/api/auth/" + mode}
        submit={
          {
            login: "Sign in",
            signup: "Create account",
            reset: "Send reset link",
            update: "Update password",
          }[mode]
        }
        onSuccess={(data) => {
          if (data.ok) {
            router.push("/app");
            router.refresh();
          }
        }}
      >
        {mode !== "update" && (
          <label>
            Email address
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@company.com"
              required
            />
          </label>
        )}
        {mode !== "reset" && (
          <label>
            Password
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
            <small>Use at least 12 characters.</small>
          </label>
        )}
      </ActionForm>
      <div className="auth-links">
        {mode === "login" ? (
          <>
            <Link href="/auth/reset">Forgot password?</Link>
            <Link href="/auth/signup">Create an account</Link>
          </>
        ) : (
          <Link href="/auth/login">Back to sign in</Link>
        )}
      </div>
    </>
  );
}
