import { MockSmsProvider } from "./mock";

export type SmsKind = "BOOKING_CONFIRMED" | "BOOKING_UPDATED" | "BOOKING_CANCELLED" | "MENU_LINK";

export interface SmsMessage {
  restaurantId: string;
  phone: string;
  kind: SmsKind;
  body: string;
}

/** Swap this implementation for Twilio / a local Israeli SMS gateway later. */
export interface SmsProvider {
  send(msg: SmsMessage): Promise<{ ok: boolean; id?: string }>;
}

let provider: SmsProvider | null = null;

export function getSmsProvider(): SmsProvider {
  provider ??= new MockSmsProvider();
  return provider;
}
