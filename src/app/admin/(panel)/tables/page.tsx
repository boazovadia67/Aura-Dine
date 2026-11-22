import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/auth";
import { ActionForm, inputCls } from "@/components/admin/Form";
import { addTableAction, toggleTableAction } from "../../actions";

export default async function TablesPage() {
  const m = await requireManager();
  const tables = await prisma.table.findMany({ where: { restaurantId: m.restaurantId }, orderBy: [{ area: "asc" }, { label: "asc" }] });

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <section>
        <h2 className="mb-4 text-xl font-semibold">שולחנות</h2>
        <div className="overflow-x-auto rounded-xl border border-sand bg-white">
          <table className="w-full text-sm">
            <thead className="bg-sand/50 text-right text-muted">
              <tr>
                <th className="p-3">שולחן</th>
                <th className="p-3">מקומות</th>
                <th className="p-3">אזור</th>
                <th className="p-3">מצב</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {tables.map((t) => (
                <tr key={t.id} className={`border-t border-sand ${t.active ? "" : "text-muted"}`}>
                  <td className="p-3 font-semibold">{t.label}</td>
                  <td className="p-3">{t.seats}</td>
                  <td className="p-3">{t.area === "OUTSIDE" ? "חוץ" : "פנים"}</td>
                  <td className="p-3">{t.active ? "פעיל" : "מושבת"}</td>
                  <td className="p-3">
                    <form action={toggleTableAction}>
                      <input type="hidden" name="tableId" value={t.id} />
                      <button className="text-xs underline">{t.active ? "השבתה" : "הפעלה"}</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          שולחן מושבת לא מוצע להזמנות חדשות. הזמנות קיימות עליו נשמרות. כל הזמנה מקבלת שולחן יחיד; שולחנות לא מחוברים.
        </p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">הוספת שולחן</h2>
        <ActionForm action={addTableAction} submitLabel="הוספה">
          <input name="label" required placeholder="שם השולחן, למשל T7" className={inputCls} />
          <input name="seats" type="number" min={1} max={30} required placeholder="מספר מקומות" className={inputCls} />
          <select name="area" className={inputCls} defaultValue="INSIDE">
            <option value="INSIDE">פנים</option>
            <option value="OUTSIDE">חוץ</option>
          </select>
        </ActionForm>
      </section>
    </div>
  );
}
