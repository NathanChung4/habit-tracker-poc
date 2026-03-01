import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/query-provider";
import { AppNav } from "@/components/app-nav";
import { getCurrentUser } from "@/lib/auth";

const displayFont = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"]
});

const monoFont = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  title: "PatternFinder Habit Tracker",
  description: "Daily consistency tracker with streak protection and reward contracts"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user } = await getCurrentUser();

  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${monoFont.variable}`}>
        <QueryProvider>
          <div className="background-layer" aria-hidden />
          <div className="app-shell">
            <header className="topbar">
              <div>
                <p className="eyebrow">PatternFinder</p>
                <h1>Consistency Engine</h1>
              </div>
              <div className="topbar-right">
                <AppNav isAuthenticated={Boolean(user)} />
                {user ? (
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="ghost">
                      Sign out
                    </button>
                  </form>
                ) : null}
              </div>
            </header>
            <main>{children}</main>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}
