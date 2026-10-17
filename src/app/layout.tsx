import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FutureFlow — Reliable by design",
  description: "A calm workspace for reliable, accountable automation.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
