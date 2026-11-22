import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { markCallbackHandledAction } from "../../actions";

const fmt = new Intl.DateTimeFormat("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" });

const SMS_KIND: Record<string, string> = {
  BOOKING_CONFIRMED: "אישור הזמנה",
  BOOKING_UPDATED: "עדכון הזמנה",
  BOOKING_CANCELLED: "ביטול הזמנה",
  MENU_LINK: "קישור לתפריט",
};

export default async function MessagesPage() {
  const m = await requireManager();
  const [callbacks, sms] = await Promise.all([
    prisma.callbackRequest.findMany({ where: { restaurantId: m.restaurantId }, orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 50 }),
    prisma.smsLog.findMany({ where: { restaurantId: m.restaurantId }, orderBy: { sentAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <h2 className="mb-1 text-xl font-semibold">בקשות לחזור ללקוח</h2>
        <p className="mb-4 text-sm text-muted">לקוחות שהעוזר לא יכל לעזור להם או שביקשו לדבר עם הצוות.</p>
        <ul className="space-y-2">
          {callbacks.map((c) => (
            <li key={c.id} className={`rounded-lg border border-sand bg-white p-3 text-sm ${c.handled ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <b>{c.name}</b>
                <span className="text-xs text-muted">{fmt.format(c.createdAt)}</span>
              </div>
              <div dir="ltr" className="text-right">{c.phone}</div>
              <p className="mt-1 text-muted">{c.reason}</p>
              {!c.handled && (
                <form action={markCallbackHandledAction} className="mt-2">
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs underline">סמן כטופל</button>
                </form>
              )}
            </li>
          ))}
          {callbacks.length === 0 && <li className="text-sm text-muted">אין בקשות.</li>}
        </ul>
      </section>

      <section>
        <h2 className="mb-1 text-xl font-semibold">הודעות SMS שנשלחו</h2>
        <p className="mb-4 text-sm text-muted">בסביבת הפיתוח ההודעות נשמרות כאן ולא נשלחות בפועל.</p>
        <ul className="space-y-2">
          {sms.map((s) => (
            <li key={s.id} className="rounded-lg border border-sand bg-white p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  {SMS_KIND[s.kind] ?? s.kind} · <span dir="ltr">{s.phone}</span>
                </span>
                <span>{fmt.format(s.sentAt)}</span>
              </div>
              <p className="mt-1">{s.body}</p>
            </li>
          ))}
          {sms.length === 0 && <li className="text-sm text-muted">עוד לא נשלחו הודעות.</li>}
        </ul>
      </section>
    </div>
  );
}
