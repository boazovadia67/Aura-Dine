import { describe, expect, it } from "vitest";
import { MASCOT_TEXT, mascotFor } from "@/lib/mascot";

describe("mascotFor", () => {
  it("picks the chef by slug for the three demo restaurants", () => {
    expect(mascotFor({ slug: "aura-trattoria", cuisine: "איטלקי" })).toBe("italian");
    expect(mascotFor({ slug: "lotus-asian-kitchen", cuisine: "אסייתי" })).toBe("asian");
    expect(mascotFor({ slug: "aura-moskva", cuisine: "רוסי" })).toBe("russian");
  });
  it("falls back to cuisine for new restaurants, then to a generic chef", () => {
    expect(mascotFor({ slug: "new-place", cuisine: "פיצה איטלקית" })).toBe("italian");
    expect(mascotFor({ slug: "new-place", cuisine: "סיני" })).toBe("asian");
    expect(mascotFor({ slug: "new-place", cuisine: "בשרים" })).toBe("default");
  });
  it("has text for every variant", () => {
    for (const v of ["italian", "asian", "russian", "default"] as const) expect(MASCOT_TEXT[v].label).toBeTruthy();
  });
});
