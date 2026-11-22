// Tools the voice agent can call. restaurantId always comes from the server-side session,
// never from model input, so an agent can only touch its own restaurant's data (§18).
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import {
  cancelBooking,
  checkAvailability,
  createBooking,
  dayAvailability,
  findBookings,
  modifyBooking,
  requestCallback,
  restaurantInfo,
  sendMenuLink,
} from "../booking/service";

export interface AgentContext {
  restaurantId: string;
  callSessionId: string;
  now: Date;
}

export interface ToolEffects {
  createdBookingIds: string[];
  endCall: boolean;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("תאריך בפורמט YYYY-MM-DD");
const time = z.string().regex(/^\d{2}:\d{2}$/).describe("שעה בפורמט HH:MM, בקפיצות של 30 דקות");
const partySize = z.number().int().min(1).max(50).describe("מספר הסועדים");
const area = z.enum(["INSIDE", "OUTSIDE", "ANY"]).describe("פנים, חוץ, או ANY אם לא משנה ללקוח");
const phone = z.string().min(5).describe("מספר הטלפון של הלקוח, ספרות בלבד");
const name = z.string().min(1).describe("שם הלקוח");

interface ToolDef<S extends z.ZodObject> {
  description: string;
  schema: S;
  run(input: z.infer<S>, ctx: AgentContext, effects: ToolEffects): Promise<unknown>;
}

function tool<S extends z.ZodObject>(def: ToolDef<S>): ToolDef<S> {
  return def;
}

export const TOOLS = {
  get_restaurant_info: tool({
    description: "פרטי המסעדה: שעות פתיחה שבועיות וחריגים, כתובת, חניה, האם פתוחה עכשיו ומדיניות ביטולים.",
    schema: z.object({}),
    run: (_i, ctx) => restaurantInfo(ctx.restaurantId, ctx.now),
  }),

  check_availability: tool({
    description: "בדיקת זמינות שולחן לתאריך, שעה, מספר סועדים ואזור. אם אין זמינות מחזיר עד שתי שעות חלופיות (alternatives).",
    schema: z.object({ date, time, partySize, area }),
    run: (i, ctx) => checkAvailability({ restaurantId: ctx.restaurantId, now: ctx.now, ...i }),
  }),

  list_day_availability: tool({
    description: "כל השעות הפנויות ביום מסוים עבור מספר סועדים ואזור. להשתמש כשהחלופות הראשונות לא התאימו ללקוח.",
    schema: z.object({ date, partySize, area }),
    run: (i, ctx) => dayAvailability({ restaurantId: ctx.restaurantId, now: ctx.now, ...i }),
  }),

  create_booking: tool({
    description: "שמירת הזמנה חדשה. להפעיל רק אחרי שהלקוח אישר במפורש את כל הפרטים. ההזמנה נשמרה רק אם התוצאה ok: true.",
    schema: z.object({ customerName: name, phone, date, time, partySize, area }),
    run: async (i, ctx, fx) => {
      const r = await createBooking({ restaurantId: ctx.restaurantId, callSessionId: ctx.callSessionId, now: ctx.now, ...i });
      if (r.ok) fx.createdBookingIds.push(r.booking.bookingId);
      return r;
    },
  }),

  find_booking: tool({
    description: "איתור הזמנות עתידיות לפי מספר טלפון. מחזיר לכל הזמנה nameMatches שמציין אם השם שנמסר תואם.",
    schema: z.object({ phone, customerName: name }),
    run: (i, ctx) => findBookings({ restaurantId: ctx.restaurantId, now: ctx.now, phone: i.phone, customerName: i.customerName }),
  }),

  modify_booking: tool({
    description: "שינוי הזמנה קיימת (תאריך, שעה, מספר סועדים או אזור). להפעיל רק אחרי אימות הלקוח ואישור מפורש של הפרטים החדשים.",
    schema: z.object({
      bookingId: z.string(),
      date: date.optional(),
      time: time.optional(),
      partySize: partySize.optional(),
      area: area.optional(),
      confirmedByCustomer: z.literal(true).describe("true רק אם הלקוח אישר במפורש"),
    }),
    run: (i, ctx) => {
      const { confirmedByCustomer: _c, ...changes } = i;
      return modifyBooking({ restaurantId: ctx.restaurantId, now: ctx.now, ...changes });
    },
  }),

  cancel_booking: tool({
    description: "ביטול הזמנה קיימת ושחרור השולחן. להפעיל רק אחרי אימות הלקוח ואישור מפורש לביטול.",
    schema: z.object({
      bookingId: z.string(),
      confirmedByCustomer: z.literal(true).describe("true רק אם הלקוח אישר במפורש את הביטול"),
    }),
    run: (i, ctx) => cancelBooking({ restaurantId: ctx.restaurantId, bookingId: i.bookingId, now: ctx.now }),
  }),

  send_menu_link: tool({
    description: "שליחת קישור לתפריט ב-SMS למספר הטלפון של הלקוח.",
    schema: z.object({ phone }),
    run: (i, ctx) => sendMenuLink({ restaurantId: ctx.restaurantId, phone: i.phone }),
  }),

  request_callback: tool({
    description: "רישום בקשה שהצוות יחזור ללקוח: כשהלקוח מבקש נציג, כשאין פתרון, כשהמסעדה סגורה או בתקלה.",
    schema: z.object({ customerName: name, phone, reason: z.string().describe("סיבת הפנייה בקצרה") }),
    run: (i, ctx) => requestCallback({ restaurantId: ctx.restaurantId, name: i.customerName, phone: i.phone, reason: i.reason }),
  }),

  end_call: tool({
    description: "סיום השיחה אחרי משפט הפרידה.",
    schema: z.object({}),
    run: async (_i, _ctx, fx) => {
      fx.endCall = true;
      return { ok: true };
    },
  }),
} satisfies Record<string, ToolDef<z.ZodObject>>;

export type ToolName = keyof typeof TOOLS;

/** Tool definitions in API format (JSON Schema generated from the zod schemas). */
export function toolDefinitions(): Anthropic.Beta.BetaTool[] {
  return Object.entries(TOOLS).map(([name, def]) => {
    const { $schema: _s, ...schema } = z.toJSONSchema(def.schema) as Record<string, unknown>;
    return {
      name,
      description: def.description,
      input_schema: { ...schema, type: "object" } as Anthropic.Beta.BetaTool.InputSchema,
    };
  });
}

/** Validate and run one tool call. Never throws: failures become is_error results. */
export async function runTool(
  name: string,
  input: unknown,
  ctx: AgentContext,
  effects: ToolEffects,
): Promise<{ content: string; isError: boolean }> {
  const def = (TOOLS as Record<string, ToolDef<z.ZodObject>>)[name];
  if (!def) return { content: JSON.stringify({ error: `unknown tool ${name}` }), isError: true };
  const parsed = def.schema.safeParse(input);
  if (!parsed.success) {
    return { content: JSON.stringify({ error: "invalid_input", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }), isError: true };
  }
  try {
    const result = await def.run(parsed.data, ctx, effects);
    return { content: JSON.stringify(result), isError: false };
  } catch (e) {
    console.error(`tool ${name} failed`, e);
    return { content: JSON.stringify({ error: "system_error", detail: "תקלה זמנית במערכת ההזמנות" }), isError: true };
  }
}
