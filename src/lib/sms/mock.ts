import { prisma } from "../db";
import type { SmsMessage, SmsProvider } from "./provider";

/** Development SMS provider: stores every message in SmsLog (visible in the manager screen). */
export class MockSmsProvider implements SmsProvider {
  async send(msg: SmsMessage) {
    const row = await prisma.smsLog.create({
      data: { restaurantId: msg.restaurantId, phone: msg.phone, kind: msg.kind, body: msg.body, provider: "mock" },
    });
    if (process.env.NODE_ENV !== "test") console.log(`[SMS mock] to ${msg.phone}: ${msg.body}`);
    return { ok: true, id: row.id };
  }
}
