import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { addDays, hebrewDate, isValidDate, toLocal } from "@/lib/time";
import { cancelBookingAction, noShowAction } from "../actions";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  CONFIRMED: { text: "מאושרת", cls: "bg-olive/15 text-olive" },
  CANCELLED: { text: "בוטלה", cls: "bg-sand text-muted" },
  NO_SHOW: { text: "לא הגיע", cls: "bg-red-100 text-red-800" },
};

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const m = await requireManager();
  const now = new Date();
  const today = toLocal(now).date;
  const sp = await searchParams;
  const date = sp.date && isValidDate(sp.date) ? sp.date : today;

  const bookings = await prisma.booking.findMany({
    where: { restaurantId: m.restaurantId, date },
    include: { table: { select: { label: true } } },
    orderBy: [{ time: "asc" }, { createdAt: "asc" }],
  });
  const active = bookings.filter((b) => b.status === "CONFIRMED");
  const guests = active.reduce((s, b) => s + b.partySize, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link href={`/admin?date=${addDays(date, -1)}`} className="rounded-lg border border-sand px-3 py-1.5 hover:bg-sand" aria-label="היום הקודם">
          →
        </Link>
        <form className="flex items-center gap-2">
          <input type="date" name="date" defaultValue={date} className="rounded-lg border border-sand bg-white px-3 py-1.5" />
          <button className="rounded-lg border border-sand px-3 py-1.5 hover:bg-sand">הצג</button>
        </form>
        <Link href={`/admin?date=${addDays(date, 1)}`} className="rounded-lg border border-sand px-3 py-1.5 hover:bg-sand" aria-label="היום הבא">
          ←
        </Link>
        {date !== today && (
          <Link href="/admin" className="text-sm text-muted underline">
            היום
          </Link>
        )}
      </div>

      <h2 className="text-xl font-semibold">{hebrewDate(date)}</h2>
      <p className="mb-4 text-sm text-muted">
        {active.length} הזמנות פעילות · {guests} סועדים
      </p>

      {bookings.length === 0 ? (
        <p className="rounded-xl border border-dashed border-sand p-8 text-center text-muted">אין הזמנות ליום זה.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-sand bg-white">
          <table className="w-full text-sm">
            <thead className="bg-sand/50 text-right text-muted">
              <tr>
                <th className="p-3">שעה</th>
                <th className="p-3">שם</th>
                <th className="p-3">טלפון</th>
                <th className="p-3">סועדים</th>
                <th className="p-3">שולחן</th>
                <th className="p-3">מספר</th>
                <th className="p-3">סטטוס</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const st = STATUS_LABEL[b.status] ?? STATUS_LABEL.CONFIRMED;
                const started = b.startAt.getTime() <= now.getTime();
                return (
                  <tr key={b.id} className="border-t border-sand">
                    <td className="p-3 font-semibold" dir="ltr">{b.time}</td>
                    <td className="p-3">{b.customerName}</td>
                    <td className="p-3" dir="ltr">{b.phone}</td>
                    <td className="p-3">{b.partySize}</td>
                    <td className="p-3">
                      {b.table.label} · {b.area === "OUTSIDE" ? "חוץ" : "פנים"}
                    </td>
                    <td className="p-3 font-mono text-xs" dir="ltr">{b.code}</td>
                    <td className="p-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${st.cls}`}>{st.text}</span>
                    </td>
                    <td className="p-3">
                      {b.status === "CONFIRMED" && (
                        <form action={started ? noShowAction : cancelBookingAction}>
                          <input type="hidden" name="bookingId" value={b.id} />
                          <button className="text-xs text-red-700 underline hover:text-red-900">
                            {started ? "סמן לא הגיע" : "ביטול"}
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
