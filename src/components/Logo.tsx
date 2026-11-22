// Aura Dine logo "Bubble Fork": a purple speech bubble with a fork cut out of it and a small
// orange microphone badge (you talk, the restaurant books). Wordmark uses Baloo 2
// (--font-brand, loaded in layout.tsx). Keep the geometry in sync with src/app/icon.svg (the favicon).
const BRAND = "#7c3aed";
const GLOW = "#ff7a3d";
const DEEP = "#2a1b4d";
const CREAM = "#faf8ff";

export function LogoMark({ size = 40, uid = "logo" }: { size?: number; uid?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden>
      <defs>
        <linearGradient id={`b-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9061f9" />
          <stop offset="1" stopColor="#5b21b6" />
        </linearGradient>
      </defs>
      {/* speech bubble */}
      <rect x="4" y="9" width="54" height="42" rx="17" fill={`url(#b-${uid})`} />
      <path d="M17 48 L11 62 L30 50 Z" fill="#5b21b6" />
      {/* fork */}
      <g fill="#ffffff">
        {[26, 32, 38].map((cx) => (
          <rect key={cx} x={cx - 1.3} y="16" width="2.6" height="14" rx="1.3" />
        ))}
        <path d="M24.7 29 H39.3 V31 C39.3 36 33.3 37 33.3 40.5 V45 Q33.3 46.6 32 46.6 Q30.7 46.6 30.7 45 V40.5 C30.7 37 24.7 36 24.7 31 Z" />
      </g>
      {/* microphone badge */}
      <circle cx="52" cy="13" r="9.5" fill={GLOW} stroke={CREAM} strokeWidth="2" />
      <rect x="49.4" y="6.8" width="5.2" height="8.6" rx="2.6" fill="#ffffff" />
      <path d="M47.2 12.6 Q47.2 18.2 52 18.2 Q56.8 18.2 56.8 12.6" fill="none" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M52 18.4 V20.2" stroke="#ffffff" strokeWidth="1.7" strokeLinecap="round" />
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
