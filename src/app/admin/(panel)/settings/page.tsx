import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { ActionForm, inputCls } from "@/components/admin/Form";
import { saveSettingsAction } from "../../actions";

export default async function SettingsPage() {
  const m = await requireManager();
  const r = await prisma.restaurant.findUniqueOrThrow({ where: { id: m.restaurantId } });

  return (
    <section className="max-w-xl">
      <h2 className="mb-4 text-xl font-semibold">הגדרות הזמנה והעוזר</h2>
      <ActionForm action={saveSettingsAction} submitLabel="שמירת הגדרות">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">משך ישיבה (דקות)</span>
          <input name="seatingMinutes" type="number" min={30} max={300} step={15} defaultValue={r.seatingMinutes} className={inputCls} />
          <span className="text-xs text-muted">אחיד לכל המסעדה. ההזמנות נפתחות כל 30 דקות.</span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">מגבלת ביטול (דקות לפני ההגעה)</span>
          <input name="cancelCutoffMinutes" type="number" min={0} defaultValue={r.cancelCutoffMinutes ?? ""} placeholder="ריק = ללא מגבלה" className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">מדיניות ביטולים (כפי שהעוזר יסביר ללקוח)</span>
          <textarea name="cancellationPolicyText" rows={2} defaultValue={r.cancellationPolicyText} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">סגנון העוזר</span>
          <select name="personaStyle" defaultValue={r.personaStyle} className={inputCls}>
            <option value="warm">חם ומזמין</option>
            <option value="formal">מנומס ומקצועי</option>
            <option value="casual">צעיר וקליל</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">קישור לתפריט (נשלח ב-SMS לפי בקשה)</span>
          <input name="menuUrl" type="url" dir="ltr" defaultValue={r.menuUrl ?? ""} className={inputCls} />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">מידע על חניה</span>
          <textarea name="parking" rows={2} defaultValue={r.parking} className={inputCls} />
        </label>

        <label className="flex items-start gap-2 rounded-lg border border-sand bg-white p-3 text-sm">
          <input name="allowBookingWhenClosed" type="checkbox" defaultChecked={r.allowBookingWhenClosed} className="mt-1" />
          <span>
            <b>לאפשר הזמנות גם כשהמסעדה סגורה</b>
            <br />
            <span className="text-muted">כבוי לפי האפיון (סעיף 11): מחוץ לשעות הפעילות העוזר מוסר את השעות ואוסף פרטים לחזרה.</span>
          </span>
        </label>
      </ActionForm>
    </section>
  );
}
