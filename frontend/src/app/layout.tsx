import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rental Housing Law Navigator",
  description:
    "Address-level housing rule lookup with citations. Not legal advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="disclaimer">
          Not legal advice — informational tool with citations from a public
          corpus. Verify with counsel before acting.
        </div>
        <div className="shell">
          <header className="nav">
            <Link href="/" className="brand">
              Rental Housing Law Navigator
              <span>Hack-Nation × RealPage · Challenge 02</span>
            </Link>
            <nav className="nav-links">
              <Link href="/">Lookup</Link>
              <Link href="/changes">Changes</Link>
              <Link href="/pipeline">Pipeline</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
