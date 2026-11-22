import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toPublic } from "@/lib/booking/service";

const Body = z.object({ sessionId: z.string().min(1) });

/**
 * Ends the call and reports what was actually saved. The end screen trusts only this
 * database answer, never what the agent said (§12.2, §20).
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const session = await prisma.callSession.findUnique({ where: { id: parsed.data.sessionId } });
  if (!session) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.status === "ACTIVE") {
    await prisma.callSession.update({ where: { id: session.id }, data: { status: "ENDED", endedAt: new Date() } });
  }

  const bookings = await prisma.booking.findMany({
    where: { callSessionId: session.id, restaurantId: session.restaurantId, status: "CONFIRMED" },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    bookings: bookings.map((b) => {
      const p = toPublic(b);
      return { code: p.code, dateHebrew: p.dateHebrew, time: p.time, partySize: p.partySize };
    }),
  });
}
