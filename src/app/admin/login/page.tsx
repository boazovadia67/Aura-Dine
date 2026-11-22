import Link from "next/link";
import { ActionForm, inputCls } from "@/components/admin/Form";
import { loginAction } from "../actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  const { reset } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">כניסת מנהל מסעדה</h1>
      {reset && <p className="mb-4 rounded-lg bg-olive/10 p-3 text-sm text-olive">הסיסמה עודכנה. אפשר להתחבר.</p>}
      <ActionForm action={loginAction} submitLabel="כניסה">
        <label className="block">
          <span className="mb-1 block text-sm">דוא״ל או שם משתמש</span>
          <input name="email" type="text" required autoComplete="username" autoCapitalize="none" spellCheck={false} dir="ltr" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm">סיסמה</span>
          <input name="password" type="password" required autoComplete="current-password" dir="ltr" className={inputCls} />
        </label>
      </ActionForm>
      <Link href="/admin/reset" className="mt-6 inline-block text-sm text-muted underline hover:text-ink">
        שכחתי סיסמה
      </Link>
    </main>
  );
}
