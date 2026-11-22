import { hebrewDate } from "../time";

interface B {
  code: string;
  customerName: string;
  date: string;
  time: string;
  partySize: number;
  area: string;
}

const areaHe = (a: string) => (a === "OUTSIDE" ? "בחוץ" : "בפנים");

export function bookingConfirmedSms(restaurant: string, b: B) {
  return `${restaurant}: שלום ${b.customerName}, ההזמנה שלך אושרה ל${hebrewDate(b.date)} בשעה ${b.time}, ${b.partySize} סועדים, ${areaHe(b.area)}. מספר הזמנה: ${b.code}.`;
}

export function bookingUpdatedSms(restaurant: string, b: B) {
  return `${restaurant}: ההזמנה ${b.code} עודכנה ל${hebrewDate(b.date)} בשעה ${b.time}, ${b.partySize} סועדים, ${areaHe(b.area)}.`;
}

export function bookingCancelledSms(restaurant: string, b: B) {
  return `${restaurant}: ההזמנה ${b.code} ל${hebrewDate(b.date)} בשעה ${b.time} בוטלה. נשמח לראותך בפעם אחרת.`;
}

export function menuLinkSms(restaurant: string, url: string) {
  return `${restaurant}: הנה התפריט שלנו: ${url}`;
}
