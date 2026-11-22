import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { logoutAction } from "../actions";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "הזמנות" },
  { href: "/admin/tables", label: "שולחנות" },
  { href: "/admin/hours", label: "שעות פעילות" },
  { href: "/admin/settings", label: "הגדרות" },
  { href: "/admin/messages", label: "SMS ובקשות חזרה" },
];

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const m = await requireManager();
  const r = await prisma.restaurant.findUniqueOrThrow({ where: { id: m.restaurantId }, select: { name: true, slug: true } });
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{r.name}</h1>
          <p className="text-sm text-muted">ממשק ניהול · {m.email}</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link href={`/r/${r.slug}`} className="text-muted underline hover:text-ink">
            לעמוד המסעדה
          </Link>
          <form action={logoutAction}>
            <button className="text-muted underline hover:text-ink">יציאה</button>
          </form>
        </div>
      </div>
      <nav className="mb-8 flex flex-wrap gap-2 border-b border-sand pb-3">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm hover:bg-sand">
            {n.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
