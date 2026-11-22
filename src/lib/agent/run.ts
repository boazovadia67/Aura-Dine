// One conversational turn: user speech text in → assistant reply text out.
// The conversation history lives in CallSession.messages and is only ever appended to.
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db";
import { isOpenAt } from "../booking/engine";
import { loadRules } from "../booking/service";
import { buildSystemPrompt, turnContext } from "./prompt";
import { runTool, toolDefinitions, type AgentContext, type ToolEffects } from "./tools";

export const MODEL = "claude-opus-5-5";
const MAX_STEPS = 8; // model calls per user turn

export const FALLBACK_REPLY =
  "מצטער, יש לי תקלה זמנית ואני לא מצליח להשלים את הבקשה כרגע. אם תרצו, אמרו לי שם ומספר טלפון והצוות יחזור אליכם.";
const SILENT = "(סוף התור)"; // placeholder kept in history only, never spoken
const REFUSAL_REPLY = "מצטער, בזה אני לא יכול לעזור. אפשר לעזור לכם בהזמנת שולחן או במידע על המסעדה?";

type Msg = Anthropic.Beta.BetaMessageParam | Anthropic.Beta.BetaSystemMessageParam;

/** Minimal surface of the Anthropic client we use, so tests can inject a fake. */
export interface MessagesClient {
  beta: { messages: { create(params: Anthropic.Beta.MessageCreateParamsNonStreaming): Promise<Anthropic.Beta.BetaMessage> } };
}

let defaultClient: MessagesClient | null = null;
function getClient(): MessagesClient {
  defaultClient ??= new Anthropic({ timeout: 45_000, maxRetries: 1 }) as unknown as MessagesClient;
  return defaultClient;
}

export interface TurnResult {
  replyText: string;
  ended: boolean;
  createdBookingIds: string[];
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .trim();
}

export async function runTurn(opts: {
  callSessionId: string;
  userText: string;
  now?: Date;
  client?: MessagesClient;
}): Promise<TurnResult> {
  const now = opts.now ?? new Date();
  const client = opts.client ?? getClient();

  const session = await prisma.callSession.findUniqueOrThrow({ where: { id: opts.callSessionId } });
  if (session.status !== "ACTIVE") throw new Error("call session is not active");
  const { rules, restaurant } = await loadRules(session.restaurantId);

  const ctx: AgentContext = { restaurantId: session.restaurantId, callSessionId: session.id, now };
  const effects: ToolEffects = { createdBookingIds: [], endCall: false };
  const messages: Msg[] = JSON.parse(session.messages);
  messages.push({ role: "user", content: opts.userText });
  messages.push({ role: "system", content: turnContext(now, isOpenAt(rules, now), rules.bookingDaysAhead) });

  const system = buildSystemPrompt(restaurant);
  const tools = toolDefinitions();
  const spoken: string[] = [];

  const save = () =>
    prisma.callSession.update({ where: { id: session.id }, data: { messages: JSON.stringify(messages) } });

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 4000,
        system,
        tools,
        messages: messages as Anthropic.Beta.BetaMessageParam[],
        output_config: { effort: "low" }, // voice: favour fast replies
        cache_control: { type: "ephemeral" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });

      if (response.stop_reason === "refusal") {
        messages.push({ role: "assistant", content: [{ type: "text", text: REFUSAL_REPLY }] });
        spoken.push(REFUSAL_REPLY);
        break;
      }

      messages.push({
        role: "assistant",
        content: response.content.length
          ? (response.content as Anthropic.Beta.BetaContentBlockParam[])
          : [{ type: "text", text: SILENT }],
      });
      const text = textOf(response.content);
      if (text) spoken.push(text);

      const toolUses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const results = await Promise.all(
        toolUses.map(async (tu) => {
          const r = await runTool(tu.name, tu.input, ctx, effects);
          return { type: "tool_result" as const, tool_use_id: tu.id, content: r.content, is_error: r.isError };
        }),
      );
      messages.push({ role: "user", content: results });
      if (effects.endCall) break; // the goodbye was already said before end_call
    }

    // Close the turn so the history always ends with an assistant message.
    if (messages.at(-1)?.role !== "assistant") {
      if (effects.endCall) {
        messages.push({ role: "assistant", content: [{ type: "text", text: SILENT }] });
        if (spoken.length === 0) spoken.push("תודה ולהתראות!");
      } else {
        messages.push({ role: "assistant", content: [{ type: "text", text: FALLBACK_REPLY }] });
        spoken.push(FALLBACK_REPLY);
      }
    }
  } catch (e) {
    console.error("agent turn failed", e);
    if (messages.at(-1)?.role !== "assistant") {
      messages.push({ role: "assistant", content: [{ type: "text", text: FALLBACK_REPLY }] });
    }
    spoken.push(FALLBACK_REPLY);
  }

  await save();
  return { replyText: spoken.join(" "), ended: effects.endCall, createdBookingIds: effects.createdBookingIds };
}
