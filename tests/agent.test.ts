import { beforeEach, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db";
import { FALLBACK_REPLY, runTurn, type MessagesClient } from "@/lib/agent/run";
import { toolDefinitions } from "@/lib/agent/tools";
import { zonedToUtc } from "@/lib/time";
import { resetDatabase, seedPilot } from "../prisma/seed-data";
import { POST as endCall } from "@/app/api/call/end/route";

const NOW = zonedToUtc("2026-11-23", "15:00");
let rid: string;
let sessionId: string;

type Block = Anthropic.Beta.BetaContentBlock;
const msg = (content: Block[], stop: string): Anthropic.Beta.BetaMessage =>
  ({ id: "msg", type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason: stop, usage: {} }) as unknown as Anthropic.Beta.BetaMessage;
const text = (t: string) => ({ type: "text", text: t, citations: null }) as unknown as Block;
const toolUse = (id: string, name: string, input: unknown) => ({ type: "tool_use", id, name, input }) as unknown as Block;

/** Fake client that replays scripted responses and records requests. */
function fakeClient(script: Array<Anthropic.Beta.BetaMessage | Error>) {
  const requests: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const client: MessagesClient = {
    beta: {
      messages: {
        async create(params) {
          requests.push(structuredClone(params));
          const next = script.shift();
          if (!next) throw new Error("script exhausted");
          if (next instanceof Error) throw next;
          return next;
        },
      },
    },
  };
  return { client, requests };
}

async function endScreen() {
  const res = await endCall(new Request("http://x/api/call/end", { method: "POST", body: JSON.stringify({ sessionId }) }));
  return (await res.json()) as { bookings: Array<{ code: string; time: string }> };
}

const bookingInput = {
  customerName: "דנה כהן",
  phone: "0501234567",
  date: "2026-11-24",
  time: "19:00",
  partySize: 2,
  area: "INSIDE",
};

beforeEach(async () => {
  await resetDatabase(prisma);
  rid = (await seedPilot(prisma)).id;
  sessionId = (await prisma.callSession.create({ data: { restaurantId: rid } })).id;
});

describe("tool definitions", () => {
  it("produce object JSON schemas", () => {
    const defs = toolDefinitions();
    const create = defs.find((d) => d.name === "create_booking")!;
    expect(create.input_schema.type).toBe("object");
    expect(create.input_schema.required).toEqual(expect.arrayContaining(["customerName", "phone", "date", "time", "partySize", "area"]));
  });
});

describe("runTurn", () => {
  it("creates a booking via the tool and the end screen confirms it from the DB", async () => {
    const { client, requests } = fakeClient([
      msg([toolUse("t1", "create_booking", bookingInput)], "tool_use"),
      msg([text("מעולה, ההזמנה נשמרה.")], "end_turn"),
    ]);
    const r = await runTurn({ callSessionId: sessionId, userText: "כן, תאשר", now: NOW, client });
    expect(r.replyText).toBe("מעולה, ההזמנה נשמרה.");
    expect(r.createdBookingIds).toHaveLength(1);

    // second request carried the tool result, the first carried the per-turn system context
    const first = requests[0].messages;
    expect(first[0]).toMatchObject({ role: "user", content: "כן, תאשר" });
    expect((first[1] as { role: string }).role).toBe("system");
    const lastMsg = requests[1].messages.at(-1) as { content: Array<{ type: string; content: string }> };
    expect(lastMsg.content[0].type).toBe("tool_result");
    expect(JSON.parse(lastMsg.content[0].content).ok).toBe(true);

    const screen = await endScreen();
    expect(screen.bookings).toHaveLength(1);
    expect(screen.bookings[0].time).toBe("19:00");
  });

  it("shows no confirmation when the model claims a booking without saving one", async () => {
    const { client } = fakeClient([msg([text("ההזמנה נשמרה!")], "end_turn")]);
    await runTurn({ callSessionId: sessionId, userText: "תזמין", now: NOW, client });
    expect((await endScreen()).bookings).toEqual([]);
  });

  it("falls back to a callback offer when the API fails, and history stays valid", async () => {
    const { client } = fakeClient([new Error("network down")]);
    const r = await runTurn({ callSessionId: sessionId, userText: "שלום", now: NOW, client });
    expect(r.replyText).toBe(FALLBACK_REPLY);
    const s = await prisma.callSession.findUniqueOrThrow({ where: { id: sessionId } });
    const history = JSON.parse(s.messages);
    expect(history.at(-1).role).toBe("assistant");
    expect((await endScreen()).bookings).toEqual([]);
  });

  it("returns invalid tool input as an error result instead of crashing", async () => {
    const { client, requests } = fakeClient([
      msg([toolUse("t1", "create_booking", { ...bookingInput, partySize: "שניים" })], "tool_use"),
      msg([text("סליחה, כמה סועדים?")], "end_turn"),
    ]);
    await runTurn({ callSessionId: sessionId, userText: "תזמין", now: NOW, client });
    const res = (requests[1].messages.at(-1) as { content: Array<{ is_error: boolean }> }).content[0];
    expect(res.is_error).toBe(true);
    expect(await prisma.booking.count()).toBe(0);
  });

  it("refuses to book while the restaurant is closed", async () => {
    const night = zonedToUtc("2026-11-23", "23:45");
    const { client, requests } = fakeClient([
      msg([toolUse("t1", "create_booking", bookingInput)], "tool_use"),
      msg([text("המסעדה סגורה כרגע.")], "end_turn"),
    ]);
    await runTurn({ callSessionId: sessionId, userText: "תזמין", now: night, client });
    const res = (requests[1].messages.at(-1) as { content: Array<{ content: string }> }).content[0];
    expect(JSON.parse(res.content).reason).toBe("restaurant_closed_now");
    expect(await prisma.booking.count()).toBe(0);
  });

  it("ends the call when the agent calls end_call", async () => {
    const { client } = fakeClient([msg([text("תודה ולהתראות!"), toolUse("t1", "end_call", {})], "tool_use")]);
    const r = await runTurn({ callSessionId: sessionId, userText: "זהו, תודה", now: NOW, client });
    expect(r.ended).toBe(true);
    expect(r.replyText).toBe("תודה ולהתראות!");
  });

  it("keeps history across turns (append-only)", async () => {
    const a = fakeClient([msg([text("לכמה אנשים?")], "end_turn")]);
    await runTurn({ callSessionId: sessionId, userText: "אני רוצה להזמין שולחן", now: NOW, client: a.client });
    const b = fakeClient([msg([text("ולאיזה יום?")], "end_turn")]);
    await runTurn({ callSessionId: sessionId, userText: "שניים", now: NOW, client: b.client });
    const sent = b.requests[0].messages;
    expect(sent.slice(0, 2)).toEqual(a.requests[0].messages); // earlier turn unchanged
    expect(sent.map((m) => m.role)).toEqual(["user", "system", "assistant", "user", "system"]);
  });
});
