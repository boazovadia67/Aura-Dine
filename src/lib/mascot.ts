export type MascotVariant = "italian" | "asian" | "russian" | "bavarian" | "default";

const BY_SLUG: Record<string, MascotVariant> = {
  "aura-trattoria": "italian",
  "lotus-asian-kitchen": "asian",
  "aura-moskva": "russian",
  "bavaria-san-mia": "bavarian",
};

/** Which chef to show on a restaurant page: by slug first, then by cuisine text. */
export function mascotFor(restaurant: { slug: string; cuisine: string }): MascotVariant {
  const bySlug = BY_SLUG[restaurant.slug];
  if (bySlug) return bySlug;
  const c = restaurant.cuisine;
  if (c.includes("איטלק")) return "italian";
  if (c.includes("אסיי") || c.includes("סיני") || c.includes("יפני") || c.includes("תאילנד")) return "asian";
  if (c.includes("רוס")) return "russian";
  if (c.includes("בוואר") || c.includes("גרמנ")) return "bavarian";
  return "default";
}

export const MASCOT_TEXT: Record<MascotVariant, { greeting: string; label: string }> = {
  italian: { greeting: "Buongiorno!", label: "שף איטלקי מחייך" },
  asian: { greeting: "你好!", label: "שף סיני מחייך" },
  russian: { greeting: "Привет!", label: "שף רוסי מחייך" },
  bavarian: { greeting: "Servus!", label: "שף בווארי מחייך" },
  default: { greeting: "ברוכים הבאים!", label: "שף מחייך" },
};
