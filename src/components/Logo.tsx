// Aura Dine logo: "Voice Fork", a fork whose tines are sound-wave bars (you talk to book a table).
// Keep the geometry in sync with src/app/icon.svg (the favicon).
const ACCENT = "#b4532a";
const INK = "#1f1b16";
const GOLD = "#e0b341";

// Tine heights rise and fall like an audio level meter.
const TINES = [
  { cx: 22.4, top: 12 },
  { cx: 28.8, top: 4 },
  { cx: 35.2, top: 4 },
  { cx: 41.6, top: 12 },
];

export function LogoMark({ size = 40, mono }: { size?: number; mono?: string }) {
  const body = mono ?? ACCENT;
  const arcs = mono ?? GOLD;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      {TINES.map((t) => (
        <rect key={t.cx} x={t.cx - 1.7} y={t.top} width="3.4" height={30 - t.top} rx="1.7" fill={body} />
      ))}
      <path
        d="M20.7 28 H43.3 V31 C43.3 38 34.2 40 34.2 46 V58 Q34.2 61 32 61 Q29.8 61 29.8 58 V46 C29.8 40 20.7 38 20.7 31 Z"
        fill={body}
      />
      <path d="M8 22 Q4 30 8 38" fill="none" stroke={arcs} strokeWidth="3" strokeLinecap="round" />
      <path d="M56 22 Q60 30 56 38" fill="none" stroke={arcs} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + "Aura Dine" wordmark. `light` is for dark backgrounds. */
export function Logo({ size = 36, light = false }: { size?: number; light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 whitespace-nowrap" dir="ltr" aria-label="Aura Dine">
      <LogoMark size={size} />
      <span className="font-extrabold leading-none tracking-tight" style={{ fontSize: size * 0.62, color: light ? "#faf6f0" : INK }}>
        Aura <span style={{ color: light ? GOLD : ACCENT }}>Dine</span>
      </span>
    </span>
  );
}
