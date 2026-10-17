"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { post } from "@/components/forms";
export default function Invite() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="auth-page">
      <Brand />
      <main id="main" className="auth-card">
        <span className="eyebrow">YOU’RE INVITED</span>
        <h1>Good work is a team sport.</h1>
        <p>
          Sign in with the invited email, then open this invitation again. The
          link is single-use and expires after 7 days.
        </p>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const token = window.location.hash.slice(1);
              const data = await post("/api/invitations/accept", { token });
              window.history.replaceState(null, "", "/invite");
              router.push("/app/" + data.id + "/overview");
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Please retry.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Joining…" : "Accept invitation"}
        </Button>
        {message && <p role="status">{message}</p>}
        <p>
          <Link href="/auth/login">Sign in</Link> ·{" "}
          <Link href="/auth/signup">Create account</Link>
        </p>
      </main>
    </div>
  );
}
