import { notFound } from "next/navigation";
import { ChefMascot } from "@/components/ChefMascot";
import { VoiceCall } from "@/components/VoiceCall";
import { mascotFor } from "@/lib/mascot";
import { getActiveRestaurant, hoursRows } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getActiveRestaurant(slug);
  if (!r) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.imageUrl} alt={r.name} className="aspect-[16/7] w-full rounded-2xl object-cover" />
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{r.name}</h1>
          <p className="mt-1 text-muted">
            {r.cuisine} · {r.city} · {r.kosher}
          </p>
        </div>
        <ChefMascot variant={mascotFor(r)} />
      </div>

      <VoiceCall slug={r.slug} restaurantName={r.name} />
      <p className="mt-3 text-sm text-muted">
        העוזר הוא עוזר דיגיטלי של המסעדה. נבקש גישה למיקרופון כדי להתחיל את השיחה.
      </p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="mb-2 font-semibold">שעות פתיחה</h2>
          <ul className="space-y-1 text-sm">
            {hoursRows(r.weeklyHours).map((row) => (
              <li key={row.days} className="flex justify-between gap-4 border-b border-sand py-1">
                <span className="text-muted">{row.days}</span>
                <span dir="ltr">{row.hours}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3 text-sm">
          <div>
            <h2 className="mb-1 font-semibold">כתובת</h2>
            <p>{r.address}</p>
          </div>
          <div>
            <h2 className="mb-1 font-semibold">חניה</h2>
            <p>{r.parking}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
