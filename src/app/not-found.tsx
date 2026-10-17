import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="auth-card">
      <h1>Workspace not available.</h1>
      <p>This page doesn’t exist or you don’t have access.</p>
      <Link href="/app">Return to your workspaces →</Link>
    </main>
  );
}
