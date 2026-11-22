import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { greetingFor } from "@/lib/agent/prompt";

const Body = z.object({ slug: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const restaurant = await prisma.restaurant.findFirst({ where: { slug: parsed.data.slug, active: true } });
  if (!restaurant) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const session = await prisma.callSession.create({ data: { restaurantId: restaurant.id } });
  return NextResponse.json({
    sessionId: session.id,
    restaurantName: restaurant.name,
    greeting: greetingFor(restaurant.name),
  });
}
