"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/admin/actions";

export const inputCls =
  "w-full rounded-lg border border-sand bg-white px-3 py-2 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
export const btnCls = "rounded-lg bg-accent px-4 py-2 font-semibold text-white transition hover:bg-accent-dark disabled:opacity-60";

/** Form bound to a server action that returns FormState; shows its error/success message. */
export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-4",
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  className?: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex items-center gap-3">
        <button type="submit" className={btnCls} disabled={pending}>
          {pending ? "שומר…" : submitLabel}
        </button>
        {state?.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state?.ok && <span className="text-sm text-olive">{state.ok}</span>}
      </div>
    </form>
  );
}
