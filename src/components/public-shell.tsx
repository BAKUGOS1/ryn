import Link from "next/link";
import { Brand } from "./brand";
export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" aria-label="FutureFlow home">
          <Brand />
        </Link>
        <nav className="public-nav" aria-label="Main navigation">
          <Link href="/use-cases">Use cases</Link>
          <Link href="/docs">Guide</Link>
          <Link href="/auth/login">Sign in</Link>
        </nav>
      </header>
      <main id="main" className="landing-main">
        {children}
      </main>
      <footer>
        <span>FUTUREFLOW · Events into accountable actions</span>
        <nav className="public-nav" aria-label="Footer navigation">
          <Link href="/docs">Guide</Link>
          <Link href="/security">Security</Link>
          <Link href="/preview">Try the demo</Link>
        </nav>
      </footer>
    </div>
  );
}
