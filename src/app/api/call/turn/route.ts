import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runTurn } from "@/lib/agent/run";

export const maxDuration = 60;

const Body = z.object({ sessionId: z.string().min(1), text: z.string().trim().min(1).max(1000) });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const session = await prisma.callSession.findUnique({ where: { id: parsed.data.sessionId } });
  if (!session || session.status !== "ACTIVE") return NextResponse.json({ error: "session_not_active" }, { status: 409 });

  const result = await runTurn({ callSessionId: session.id, userText: parsed.data.text });
  return NextResponse.json({ reply: result.replyText, ended: result.ended });
}
