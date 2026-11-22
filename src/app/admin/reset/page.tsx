import Link from "next/link";
import { ActionForm, inputCls } from "@/components/admin/Form";
import { requestResetAction, resetPasswordAction } from "../actions";

export default function ResetPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">איפוס סיסמה</h1>

      <section className="mb-10">
        <h2 className="mb-3 font-semibold">1. קבלת קוד לדוא״ל</h2>
        <ActionForm action={requestResetAction} submitLabel="שליחת קוד">
          <input name="email" type="text" required placeholder="דוא״ל או שם משתמש" autoCapitalize="none" dir="ltr" className={inputCls} />
        </ActionForm>
      </section>

      <section>
        <h2 className="mb-3 font-semibold">2. בחירת סיסמה חדשה</h2>
        <ActionForm action={resetPasswordAction} submitLabel="עדכון סיסמה">
          <input name="email" type="text" required placeholder="דוא״ל או שם משתמש" autoCapitalize="none" dir="ltr" className={inputCls} />
          <input name="code" inputMode="numeric" required placeholder="קוד בן 6 ספרות" dir="ltr" className={inputCls} />
          <input name="password" type="password" required minLength={8} placeholder="סיסמה חדשה (8 תווים לפחות)" dir="ltr" className={inputCls} />
        </ActionForm>
      </section>

      <Link href="/admin/login" className="mt-8 inline-block text-sm text-muted underline hover:text-ink">
        חזרה לכניסה
      </Link>
    </main>
  );
}
