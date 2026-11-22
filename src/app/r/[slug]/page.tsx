import { notFound } from "next/navigation";
import { AvailabilityBoard } from "@/components/AvailabilityBoard";
import { ChefMascot } from "@/components/ChefMascot";
import { VoiceCall } from "@/components/VoiceCall";
import { availabilityOverview } from "@/lib/booking/service";
import { mascotFor } from "@/lib/mascot";
import { getActiveRestaurant, hoursRows } from "@/lib/restaurants";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getActiveRestaurant(slug);
  if (!r) notFound();
  const availability = await availabilityOverview(r.id, { days: 7 });

  return (
    <main className="pb-16">
      {/* full-width photo that flows out of the purple header */}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={r.imageUrl} alt={r.name} className="h-64 w-full object-cover sm:h-80" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-brand/60 via-transparent to-brand-deep/40" />
      </div>

      <div className="mx-auto max-w-3xl px-4">
        {/* main card: overlaps the photo, the chef stands on its top edge */}
        <section className="relative -mt-14 rounded-3xl bg-white p-6 shadow-xl shadow-brand/15 ring-1 ring-sand sm:p-8">
          <div className="absolute bottom-[calc(100%-12px)] left-4 sm:left-8">
            <ChefMascot variant={mascotFor(r)} />
          </div>

          <h1 className="text-3xl font-extrabold text-ink sm:text-4xl">{r.name}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-brand-soft px-3 py-1 font-semibold text-brand">{r.cuisine}</span>
            <span className="rounded-full bg-cream px-3 py-1 text-muted ring-1 ring-sand">{r.city}</span>
            <span className="rounded-full bg-cream px-3 py-1 text-muted ring-1 ring-sand">{r.kosher}</span>
          </div>

          <VoiceCall slug={r.slug} restaurantName={r.name} />
          <p className="mt-3 text-sm text-muted">העוזר הוא עוזר דיגיטלי של המסעדה. נבקש גישה למיקרופון כדי להתחיל את השיחה.</p>
        </section>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 ring-1 ring-sand">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-brand">
              <ClockIcon /> שעות פתיחה
            </h2>
            <ul className="text-sm">
              {hoursRows(r.weeklyHours).map((row) => (
                <li key={row.days} className="flex justify-between gap-4 border-b border-sand py-2 last:border-0">
                  <span className="text-muted">{row.days}</span>
                  <span dir="ltr" className="font-medium">{row.hours}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-6 ring-1 ring-sand">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-brand">
              <PinIcon /> כתובת וחניה
            </h2>
            <p className="font-medium">{r.address}</p>
            <p className="mt-3 text-sm leading-relaxed text-muted">{r.parking}</p>
          </section>
        </div>

        <AvailabilityBoard data={availability} />
      </div>
    </main>
  );
}

function ClockIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}
