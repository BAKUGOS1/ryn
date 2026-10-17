"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="auth-card">
      <h1>Something didn’t connect.</h1>
      <p>
        We couldn’t load this workspace. Your changes may not have been saved.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
