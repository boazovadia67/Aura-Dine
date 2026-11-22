import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });

export const metadata: Metadata = {
  title: "Aura Dine",
  description: "הזמנת שולחן בשיחה קולית עם העוזר הדיגיטלי של המסעדה",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-sand">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" className="text-xl font-bold tracking-tight">
              Aura <span className="text-accent">Dine</span>
            </Link>
            <Link href="/admin" className="text-sm text-muted hover:text-ink">
              כניסת מסעדות
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
