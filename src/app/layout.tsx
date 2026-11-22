import type { Metadata } from "next";
import { Baloo_2, Heebo } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });
const baloo = Baloo_2({ subsets: ["latin"], weight: ["800"], variable: "--font-baloo" });

export const metadata: Metadata = {
  title: "Aura Dine",
  description: "הזמנת שולחן בשיחה קולית עם העוזר הדיגיטלי של המסעדה",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${baloo.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <header className="border-b border-sand">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" aria-label="Aura Dine, דף הבית">
              <Logo size={34} />
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
