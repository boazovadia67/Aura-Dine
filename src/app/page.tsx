import Link from "next/link";
import { hoursRows, listActiveRestaurants } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

export default async function Home() {
  const restaurants = await listActiveRestaurants();
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <section className="mb-10">
        <h1 className="text-3xl font-bold sm:text-4xl">הזמנת שולחן? פשוט מדברים.</h1>
        <p className="mt-3 max-w-2xl text-lg text-muted">
          בחרו מסעדה ודברו עם העוזר הקולי שלה. בלי המתנה על הקו ובלי טפסים: בודקים זמינות, מזמינים, משנים או מבטלים.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {restaurants.map((r) => (
          <Link
            key={r.id}
            href={`/r/${r.slug}`}
            className="group overflow-hidden rounded-2xl border border-sand bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt={r.name} className="aspect-[16/10] w-full object-cover" />
            <div className="p-5">
              <h2 className="text-xl font-semibold group-hover:text-accent">{r.name}</h2>
              <p className="mt-1 text-sm text-muted">
                {r.cuisine} · {r.city} · {r.kosher}
              </p>
              <ul className="mt-3 space-y-0.5 text-sm">
                {hoursRows(r.weeklyHours).map((row) => (
                  <li key={row.days} className="flex justify-between gap-4">
                    <span className="text-muted">{row.days}</span>
                    <span dir="ltr">{row.hours}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        ))}
        {restaurants.length === 0 && <p className="text-muted">אין כרגע מסעדות פעילות.</p>}
      </section>
    </main>
  );
}
