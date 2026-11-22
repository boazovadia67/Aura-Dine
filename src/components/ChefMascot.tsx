import { MASCOT_TEXT, type MascotVariant } from "@/lib/mascot";

const SKIN = "#f3c9a5";
const INK = "#2b1d16";

interface Palette {
  jacket: string;
  hatBand: string;
}

const PALETTE: Record<MascotVariant, Palette> = {
  italian: { jacket: "#ffffff", hatBand: "#2e8b57" },
  asian: { jacket: "#b4202a", hatBand: "#b4202a" },
  russian: { jacket: "#ffffff", hatBand: "#c8102e" },
  default: { jacket: "#ffffff", hatBand: "#b4532a" },
};

/** Small smiling chef that bounces and waves. Each cuisine gets its own outfit. */
export function ChefMascot({ variant }: { variant: MascotVariant }) {
  const { greeting, label } = MASCOT_TEXT[variant];
  const p = PALETTE[variant];

  return (
    <div className="chef-wrap relative flex flex-col items-center" role="img" aria-label={label}>
      <div className="chef-bubble relative mb-1 rounded-xl border border-sand bg-white px-3 py-1 text-sm font-semibold shadow-sm">
        <span dir="auto">{greeting}</span>
        <span className="absolute -bottom-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 border-b border-r border-sand bg-white" />
      </div>

      <div className="chef-bounce">
        <svg viewBox="0 0 130 150" width="104" height="120" aria-hidden>
          {/* waving arm (behind the body) */}
          <g className="chef-wave">
            <path d="M92 112 L108 88" stroke={p.jacket} strokeWidth="13" strokeLinecap="round" />
            <path d="M92 112 L108 88" stroke="#00000014" strokeWidth="13" strokeLinecap="round" fill="none" />
            <circle cx="110" cy="84" r="8" fill={SKIN} />
          </g>

          {/* body */}
          <path d="M20 150 C20 114 38 102 62 102 C86 102 104 114 104 150 Z" fill={p.jacket} stroke="#00000022" strokeWidth="1.5" />
          {variant === "asian" && (
            <>
              {/* stand collar and frog buttons */}
              <path d="M50 102 L62 118 L74 102" fill="none" stroke="#e0b341" strokeWidth="4" strokeLinejoin="round" />
              <circle cx="62" cy="128" r="3" fill="#e0b341" />
              <circle cx="62" cy="138" r="3" fill="#e0b341" />
            </>
          )}
          {variant === "italian" && (
            <>
              <path d="M46 102 L78 102 L62 122 Z" fill="#c8102e" />
              <circle cx="62" cy="134" r="2.5" fill="#9aa0a6" />
              <circle cx="62" cy="144" r="2.5" fill="#9aa0a6" />
            </>
          )}
          {variant === "russian" && (
            <>
              {/* embroidered collar */}
              <path d="M48 102 L62 112 L76 102" fill="none" stroke="#c8102e" strokeWidth="6" strokeLinejoin="round" />
              <g fill="#c8102e">
                <circle cx="62" cy="122" r="2" />
                <circle cx="62" cy="130" r="2" />
                <circle cx="62" cy="138" r="2" />
              </g>
            </>
          )}
          {variant === "default" && (
            <>
              <circle cx="62" cy="126" r="2.5" fill="#9aa0a6" />
              <circle cx="62" cy="138" r="2.5" fill="#9aa0a6" />
            </>
          )}

          {/* neck + head */}
          <rect x="54" y="92" width="16" height="14" rx="5" fill={SKIN} />
          <circle cx="62" cy="68" r="30" fill={SKIN} stroke="#00000014" strokeWidth="1.5" />

          {/* chef hat */}
          <g>
            <circle cx="46" cy="30" r="13" fill="#fff" stroke="#00000022" strokeWidth="1.5" />
            <circle cx="62" cy="23" r="15" fill="#fff" stroke="#00000022" strokeWidth="1.5" />
            <circle cx="78" cy="30" r="13" fill="#fff" stroke="#00000022" strokeWidth="1.5" />
            <rect x="40" y="32" width="44" height="18" rx="4" fill="#fff" stroke="#00000022" strokeWidth="1.5" />
            <rect x="40" y="42" width="44" height="8" fill={p.hatBand} />
          </g>

          {/* russian beard (under the mouth) */}
          {variant === "russian" && (
            <path d="M33 70 C33 108 91 108 91 70 C84 90 40 90 33 70 Z" fill="#c9792f" />
          )}

          {/* cheeks */}
          <circle cx="42" cy="78" r="5" fill="#f28b82" opacity="0.55" />
          <circle cx="82" cy="78" r="5" fill="#f28b82" opacity="0.55" />

          {/* happy eyes */}
          <path d="M44 66 Q50 58 56 66" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M68 66 Q74 58 80 66" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />

          {/* italian moustache */}
          {variant === "italian" && (
            <path d="M42 80 C48 74 58 77 62 80 C66 77 76 74 82 80 C76 86 68 82 62 82 C56 82 48 86 42 80 Z" fill="#3b2a20" />
          )}

          {/* big smile */}
          <path d="M49 85 Q62 102 75 85 Z" fill="#7a1f1f" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M55 92 Q62 97 69 92 Q62 90 55 92 Z" fill="#e8737a" />
        </svg>
      </div>
      <div className="chef-shadow mt-0.5 h-2 w-16 rounded-full bg-ink/15" />
    </div>
  );
}
