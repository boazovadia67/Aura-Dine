import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { ActionForm, inputCls } from "@/components/admin/Form";
import { HEBREW_WEEKDAYS, hebrewDate, toLocal } from "@/lib/time";
import { addExceptionAction, deleteExceptionAction, saveWeeklyHoursAction } from "../../actions";

export default async function HoursPage() {
  const m = await requireManager();
  const today = toLocal(new Date()).date;
  const [weekly, exceptions] = await Promise.all([
    prisma.weeklyHours.findMany({ where: { restaurantId: m.restaurantId } }),
    prisma.hoursException.findMany({ where: { restaurantId: m.restaurantId, date: { gte: today } }, orderBy: { date: "asc" } }),
  ]);
  const byDay = new Map(weekly.map((w) => [w.weekday, w]));

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="mb-4 text-xl font-semibold">שעות פעילות שבועיות</h2>
        <ActionForm action={saveWeeklyHoursAction} submitLabel="שמירת שעות">
          <div className="space-y-2">
            {HEBREW_WEEKDAYS.map((name, d) => {
              const h = byDay.get(d);
              return (
                <div key={d} className="grid grid-cols-[70px_1fr_1fr_auto] items-center gap-2">
                  <span className="text-sm font-medium">{name}</span>
                  <input name={`open_${d}`} type="time" defaultValue={h?.open ?? "12:00"} className={inputCls} dir="ltr" />
                  <input name={`close_${d}`} type="time" defaultValue={h?.close === "24:00" ? "00:00" : (h?.close ?? "23:00")} className={inputCls} dir="ltr" />
                  <label className="flex items-center gap-1 text-sm">
                    <input name={`closed_${d}`} type="checkbox" defaultChecked={h?.closed ?? false} /> סגור
                  </label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted">שעת סגירה מוקדמת משעת הפתיחה נחשבת כאחרי חצות.</p>
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">חריגים לתאריך מסוים</h2>
        <ActionForm action={addExceptionAction} submitLabel="שמירת חריג">
          <input name="date" type="date" min={today} required className={inputCls} />
          <label className="flex items-center gap-2 text-sm">
            <input name="closed" type="checkbox" defaultChecked /> סגור כל היום
          </label>
          <div className="grid grid-cols-2 gap-2">
            <input name="open" type="time" className={inputCls} dir="ltr" aria-label="פתיחה" />
            <input name="close" type="time" className={inputCls} dir="ltr" aria-label="סגירה" />
          </div>
          <input name="note" placeholder="הערה, למשל ערב חג" className={inputCls} />
        </ActionForm>

        <ul className="mt-6 space-y-2">
          {exceptions.map((e) => (
            <li key={e.id} className="flex items-center justify-between rounded-lg border border-sand bg-white p-3 text-sm">
              <span>
                <b>{hebrewDate(e.date)}</b> · {e.closed ? "סגור" : <span dir="ltr">{`${e.open}–${e.close}`}</span>}
                {e.note && <span className="text-muted"> · {e.note}</span>}
              </span>
              <form action={deleteExceptionAction}>
                <input type="hidden" name="id" value={e.id} />
                <button className="text-xs text-red-700 underline">מחיקה</button>
              </form>
            </li>
          ))}
          {exceptions.length === 0 && <li className="text-sm text-muted">אין חריגים קרובים.</li>}
        </ul>
      </section>
    </div>
  );
}
