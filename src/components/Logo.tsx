// Aura Dine logo "Berry Aura": a white talking plate (happy eyes, open mouth) with a purple rim and voice arcs that glow
// from purple to orange like an aura. Wordmark uses Baloo 2 (--font-brand, loaded in layout.tsx).
// Keep the geometry in sync with src/app/icon.svg (the favicon).
const BRAND = "#7c3aed";
const GLOW = "#ff7a3d";
const DEEP = "#2a1b4d";
const INK = "#1d1530";
const CREAM = "#faf8ff";

export function LogoMark({ size = 40, uid = "logo" }: { size?: number; uid?: string }) {
  const grad = `url(#g-${uid})`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={`g-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={BRAND} />
          <stop offset="1" stopColor={GLOW} />
        </linearGradient>
      </defs>
      <circle cx="29" cy="32" r="22" fill="#ffffff" stroke={BRAND} strokeWidth="3.6" />
      <circle cx="29" cy="32" r="16.5" fill="none" stroke={BRAND} strokeOpacity="0.22" strokeWidth="1.5" />
      {/* happy eyes */}
      <path d="M19.5 27 Q23 22 26.5 27" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M31.5 27 Q35 22 38.5 27" fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      {/* open, talking mouth */}
      <path d="M20.5 35 Q29 49 37.5 35 Z" fill="#7a1f1f" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M25 42 Q29 46 33 42 Q29 40 25 42 Z" fill="#e8737a" />
      <circle cx="17.5" cy="34" r="2.6" fill="#f28b82" opacity="0.6" />
      <circle cx="40.5" cy="34" r="2.6" fill="#f28b82" opacity="0.6" />
      {/* voice arcs */}
      <path d="M54 22 Q58.5 32 54 42" fill="none" stroke={grad} strokeWidth="3" strokeLinecap="round" />
      <path d="M60 15 Q67 32 60 49" fill="none" stroke={grad} strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** Mark + "Aura Dine" wordmark. `light` is for dark backgrounds. */
export function Logo({ size = 36, light = false, uid = "logo" }: { size?: number; light?: boolean; uid?: string }) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap" dir="ltr" aria-label="Aura Dine">
      <LogoMark size={size} uid={uid} />
      <span
        className="leading-none"
        style={{ fontFamily: "var(--font-brand)", fontWeight: 800, fontSize: size * 0.72, letterSpacing: "-0.01em" }}
      >
        <span style={{ color: light ? CREAM : DEEP }}>Aura</span> <span style={{ color: BRAND }}>Dine</span>
      </span>
    </span>
  );
}
