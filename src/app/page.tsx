import Link from "next/link";
import { hoursRows, listActiveRestaurants } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

export default async function Home() {
  const restaurants = await listActiveRestaurants();
  return (
    <main>
      {/* brand hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand to-[#6a2ee0] text-white">
        <span aria-hidden className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-white/10" />
        <span aria-hidden className="absolute -left-8 top-32 h-40 w-40 rounded-full bg-glow/25" />
        <span aria-hidden className="absolute -bottom-28 right-10 h-64 w-64 rounded-full bg-white/10" />
        <div className="relative mx-auto max-w-5xl px-4 pb-24 pt-10 sm:pb-28 sm:pt-14">
          <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">
            הזמנת שולחן?
            <br />
            פשוט מדברים.
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">
            בחרו מסעדה ודברו עם העוזר הקולי שלה. בלי המתנה על הקו ובלי טפסים: בודקים זמינות, מזמינים, משנים או מבטלים.
          </p>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-14 grid max-w-5xl gap-6 px-4 pb-14 sm:grid-cols-2 lg:grid-cols-3">
        {restaurants.map((r) => (
          <Link
            key={r.id}
            href={`/r/${r.slug}`}
            className="group overflow-hidden rounded-2xl bg-white shadow-lg shadow-brand/10 ring-1 ring-sand transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand/25"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt={r.name} className="aspect-[16/10] w-full object-cover" />
            <div className="p-5">
              <h2 className="text-xl font-bold group-hover:text-brand">{r.name}</h2>
              <p className="mt-1 text-sm text-muted">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{r.cuisine}</span>
                <span className="mx-1">·</span>
                {r.city} · {r.kosher}
              </p>
              <ul className="mt-3 space-y-0.5 text-sm">
                {hoursRows(r.weeklyHours).map((row) => (
                  <li key={row.days} className="flex justify-between gap-4">
                    <span className="text-muted">{row.days}</span>
                    <span dir="ltr">{row.hours}</span>
                  </li>
                ))}
              </ul>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">לשיחה עם העוזר ←</span>
            </div>
          </Link>
        ))}
        {restaurants.length === 0 && <p className="text-muted">אין כרגע מסעדות פעילות.</p>}
      </section>
    </main>
  );
}
