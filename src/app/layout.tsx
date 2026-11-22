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
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <header className="bg-brand text-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
            <Link href="/" aria-label="Aura Dine, דף הבית">
              <Logo size={36} onBrand />
            </Link>
            <Link href="/admin" className="rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/25">
              כניסת מסעדות
            </Link>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="bg-brand-deep text-white/80">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm">
            <Logo size={26} onBrand uid="footer" />
            <span>הזמנת שולחן בשיחה קולית, בעברית.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
