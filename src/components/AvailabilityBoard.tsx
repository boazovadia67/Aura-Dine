"use client";

import { useMemo, useState } from "react";
import type { AvailabilityOverview } from "@/lib/booking/service";

type Area = "INSIDE" | "OUTSIDE";

const AREA_LABEL: Record<Area, string> = { INSIDE: "בפנים", OUTSIDE: "בחוץ" };

function countFor(day: AvailabilityOverview["days"][number], party: number, areas: AvailabilityOverview["areas"]) {
  const s = day.byParty[party];
  if (!s) return 0;
  return (areas.INSIDE ? s.INSIDE.length : 0) + (areas.OUTSIDE ? s.OUTSIDE.length : 0);
}

/** Public "free tables" board: pick a party size and a day, see free times inside and outside. */
export function AvailabilityBoard({ data }: { data: AvailabilityOverview }) {
  const [party, setParty] = useState(data.partySizes[0] ?? 2);
  const firstOpen = data.days.findIndex((d) => !d.closed && countFor(d, party, data.areas) > 0);
  const [dayIdx, setDayIdx] = useState(firstOpen >= 0 ? firstOpen : 0);
  const day = data.days[dayIdx];
  const areas = (["INSIDE", "OUTSIDE"] as Area[]).filter((a) => data.areas[a]);

  const counts = useMemo(() => data.days.map((d) => countFor(d, party, data.areas)), [data, party]);

  return (
    <section className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-sand">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-brand">
            <CalendarIcon /> מקומות פנויים
          </h2>
          <p className="mt-1 text-sm text-muted">
            שעות פנויות לפי ההזמנות במערכת, לישיבה של {data.seatingMinutes} דקות. ההזמנה עצמה דרך העוזר הקולי.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-cream p-1 ring-1 ring-sand" role="group" aria-label="מספר סועדים">
          {data.partySizes.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setParty(p)}
              aria-pressed={p === party}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${p === party ? "bg-brand text-white shadow" : "text-muted hover:text-ink"}`}
            >
              {p} סועדים
            </button>
          ))}
        </div>
      </div>

      {/* day tabs */}
      <div className="-mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-2" role="tablist" aria-label="בחירת יום">
        {data.days.map((d, i) => {
          const n = counts[i];
          const selected = i === dayIdx;
          const status = d.closed ? "סגור" : n === 0 ? "מלא" : `${n} שעות`;
          const dot = d.closed ? "bg-muted/40" : n === 0 ? "bg-red-500" : n <= 4 ? "bg-amber-400" : "bg-emerald-500";
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDayIdx(i)}
              className={`flex min-w-[84px] shrink-0 flex-col items-center rounded-xl px-3 py-2 text-sm transition ${
                selected ? "bg-brand text-white shadow-md shadow-brand/30" : "bg-cream text-ink ring-1 ring-sand hover:ring-brand/40"
              }`}
            >
              <span className="font-bold">{d.dayLabel}</span>
              <span className={selected ? "text-white/80" : "text-muted"}>{d.dateLabel}</span>
              <span className={`mt-1 flex items-center gap-1 text-xs ${selected ? "text-white" : "text-muted"}`}>
                <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                {status}
              </span>
            </button>
          );
        })}
      </div>

      {/* selected day */}
      <div className="mt-4">
        {day.closed ? (
          <p className="rounded-xl bg-cream p-5 text-center text-muted ring-1 ring-sand">המסעדה סגורה ביום זה.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted">
              שעות פתיחה ביום זה: <span dir="ltr" className="font-medium text-ink">{day.hours}</span>
            </p>
            <div className={`grid gap-4 ${areas.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {areas.map((a) => (
                <AreaCard key={a} area={a} times={day.byParty[party]?.[a] ?? []} />
              ))}
            </div>
          </>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        {data.openNow
          ? "המידע מתעדכן בכל טעינה של הדף. שעה שמופיעה כאן עדיין יכולה להיתפס עד שההזמנה נשמרת."
          : "המסעדה סגורה כרגע. העוזר מקבל הזמנות בשעות הפעילות, ומחוץ להן אפשר להשאיר פרטים לחזרה."}
      </p>
    </section>
  );
}

function AreaCard({ area, times }: { area: Area; times: string[] }) {
  const lunch = times.filter((t) => t < "17:00");
  const evening = times.filter((t) => t >= "17:00");
  return (
    <div className="rounded-xl bg-cream p-4 ring-1 ring-sand">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold">
          {area === "INSIDE" ? <HouseIcon /> : <SunIcon />} {AREA_LABEL[area]}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${times.length ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
          {times.length ? `${times.length} שעות פנויות` : "אין מקום"}
        </span>
      </div>
      {times.length === 0 ? (
        <p className="text-sm text-muted">אין שולחן פנוי {AREA_LABEL[area]} ביום זה למספר הסועדים שבחרתם.</p>
      ) : (
        <div className="space-y-3">
          <TimeRow label="צהריים" times={lunch} />
          <TimeRow label="ערב" times={evening} />
        </div>
      )}
    </div>
  );
}

function TimeRow({ label, times }: { label: string; times: string[] }) {
  if (times.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {times.map((t) => (
          <span key={t} dir="ltr" className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-brand ring-1 ring-brand/25">
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand" aria-hidden>
      <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-glow" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
