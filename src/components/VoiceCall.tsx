"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createRecognizer, isSpeechRecognitionSupported, SttError, type Recognizer } from "@/lib/voice/stt";
import { createSpeaker, type Speaker } from "@/lib/voice/tts";

type Phase =
  | "idle"
  | "mic"
  | "denied"
  | "unsupported"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "ending"
  | "ended";

interface SavedBooking {
  code: string;
  dateHebrew: string;
  time: string;
  partySize: number;
}

const STATUS: Partial<Record<Phase, string>> = {
  connecting: "מתחברים…",
  listening: "מקשיב…",
  thinking: "רגע, בודק…",
  speaking: "מדבר…",
  ending: "מסיים את השיחה…",
};

const MAX_SILENCES = 4;

async function postJson<T>(url: string, body: unknown, retries = 1): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (i >= retries) throw e;
    }
  }
}

export function VoiceCall({ slug, restaurantName }: { slug: string; restaurantName: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [noHebrewVoice, setNoHebrewVoice] = useState(false);
  const [bookings, setBookings] = useState<SavedBooking[] | null>(null);
  const [endNote, setEndNote] = useState<string | null>(null);

  const active = useRef(false);
  const sessionId = useRef<string | null>(null);
  const recognizer = useRef<Recognizer | null>(null);
  const speaker = useRef<Speaker | null>(null);

  const finish = useCallback(async (note?: string) => {
    if (!active.current && !sessionId.current) return;
    active.current = false;
    recognizer.current?.abort();
    speaker.current?.cancel();
    setPhase("ending");
    let saved: SavedBooking[] | null = null;
    if (sessionId.current) {
      try {
        const r = await postJson<{ bookings: SavedBooking[] }>("/api/call/end", { sessionId: sessionId.current }, 2);
        saved = r.bookings;
      } catch {
        saved = null; // unknown – never show a confirmation we can't verify
      }
    }
    sessionId.current = null;
    setBookings(saved);
    setEndNote(note ?? null);
    setPhase("ended");
  }, []);

  const say = useCallback(async (text: string) => {
    if (!active.current || !speaker.current) return;
    setPhase("speaking");
    await speaker.current.speak(text);
  }, []);

  const conversation = useCallback(
    async (greeting: string) => {
      await say(greeting);
      let silences = 0;
      while (active.current) {
        setPhase("listening");
        let heard = "";
        try {
          heard = await recognizer.current!.listenOnce();
        } catch (e) {
          if (!active.current) return;
          const code = e instanceof SttError ? e.code : "unknown";
          if (code === "not-allowed" || code === "service-not-allowed") {
            active.current = false;
            setPhase("denied");
            return;
          }
          await finish("הייתה בעיה בזיהוי הדיבור, ולכן השיחה הסתיימה.");
          return;
        }
        if (!active.current) return;
        if (!heard) {
          silences++;
          if (silences === 2) await say("אתם עדיין איתי?");
          if (silences >= MAX_SILENCES) {
            await say("לא שמעתי אתכם, אז אסיים את השיחה. תודה ולהתראות.");
            await finish();
            return;
          }
          continue;
        }
        silences = 0;
        setPhase("thinking");
        try {
          const r = await postJson<{ reply: string; ended: boolean }>("/api/call/turn", { sessionId: sessionId.current, text: heard });
          await say(r.reply);
          if (r.ended) {
            await finish();
            return;
          }
        } catch {
          await say("יש כרגע בעיית תקשורת, ולכן אסיים את השיחה. מצטער על אי הנוחות.");
          await finish("השיחה נקטעה בגלל בעיית תקשורת.");
          return;
        }
      }
    },
    [finish, say],
  );

  const start = useCallback(async () => {
    setOpen(true);
    setBookings(null);
    setEndNote(null);
    // Unlock speech output while we still hold the click's user activation.
    try {
      speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch {}
    if (!isSpeechRecognitionSupported() || typeof speechSynthesis === "undefined") {
      setPhase("unsupported");
      return;
    }
    setPhase("mic");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
    } catch {
      setPhase("denied");
      return;
    }
    setPhase("connecting");
    try {
      speaker.current ??= await createSpeaker();
      setNoHebrewVoice(!speaker.current.hasHebrewVoice());
      recognizer.current ??= createRecognizer("he-IL");
      const s = await postJson<{ sessionId: string; greeting: string }>("/api/call/start", { slug });
      sessionId.current = s.sessionId;
      active.current = true;
      void conversation(s.greeting);
    } catch {
      active.current = false;
      setEndNote("לא הצלחנו להתחבר לעוזר כרגע. נסו שוב בעוד רגע.");
      setBookings([]);
      setPhase("ended");
    }
  }, [conversation, slug]);

  // If the tab is closed mid-call, still close the session server-side.
  useEffect(() => {
    const onHide = () => {
      if (sessionId.current) {
        navigator.sendBeacon("/api/call/end", new Blob([JSON.stringify({ sessionId: sessionId.current })], { type: "application/json" }));
      }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      active.current = false;
      recognizer.current?.abort();
      speaker.current?.cancel();
    };
  }, []);

  const close = () => {
    setOpen(false);
    setPhase("idle");
  };

  const inCall = phase === "connecting" || phase === "listening" || phase === "thinking" || phase === "speaking" || phase === "mic";

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-5 text-xl font-semibold text-white shadow-lg transition hover:bg-accent-dark sm:inline-flex sm:w-auto"
      >
        <MicIcon />
        דברו עם העוזר הקולי
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-cream" role="dialog" aria-modal="true" aria-label={`שיחה עם ${restaurantName}`}>
          <h2 className="mb-12 text-center text-2xl font-semibold">{restaurantName}</h2>

          {(inCall || phase === "ending") && (
            <>
              <Aura phase={phase} />
              <p className="mt-10 h-6 text-lg text-cream/80" aria-live="polite">
                {phase === "mic" ? "מבקשים גישה למיקרופון…" : STATUS[phase]}
              </p>
              {noHebrewVoice && (
                <p className="mt-2 max-w-sm text-center text-sm text-amber-300">
                  לא נמצא קול עברי בדפדפן, ולכן ההקראה עלולה להישמע לא טוב. מומלץ להשתמש ב-Microsoft Edge.
                </p>
              )}
              <button
                type="button"
                onClick={() => finish()}
                disabled={phase === "ending"}
                className="mt-14 flex items-center gap-2 rounded-full bg-red-600 px-8 py-4 text-lg font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                <HangUpIcon />
                סיום שיחה
              </button>
            </>
          )}

          {phase === "denied" && (
            <Panel>
              <p className="text-lg font-semibold">אין גישה למיקרופון</p>
              <p className="mt-3 text-cream/80">
                כדי לדבר עם העוזר צריך לאשר גישה למיקרופון. לחצו על סמל המנעול או המיקרופון בשורת הכתובת של הדפדפן, אפשרו
                &quot;מיקרופון&quot; ונסו שוב.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button onClick={start} className="rounded-full bg-accent px-6 py-3 font-semibold text-white hover:bg-accent-dark">
                  נסו שוב
                </button>
                <button onClick={close} className="rounded-full border border-cream/30 px-6 py-3 hover:bg-cream/10">
                  סגירה
                </button>
              </div>
            </Panel>
          )}

          {phase === "unsupported" && (
            <Panel>
              <p className="text-lg font-semibold">הדפדפן לא תומך בשיחה קולית</p>
              <p className="mt-3 text-cream/80">כדי לדבר עם העוזר, פתחו את העמוד ב-Google Chrome או ב-Microsoft Edge.</p>
              <button onClick={close} className="mt-6 rounded-full border border-cream/30 px-6 py-3 hover:bg-cream/10">
                סגירה
              </button>
            </Panel>
          )}

          {phase === "ended" && (
            <Panel>
              <p className="text-2xl font-semibold">תודה שדיברתם איתנו!</p>
              {endNote && <p className="mt-3 text-cream/80">{endNote}</p>}
              {bookings && bookings.length > 0 && (
                <div className="mt-6 rounded-2xl bg-olive/40 p-5 text-right">
                  <p className="flex items-center gap-2 text-lg font-semibold">
                    <CheckIcon /> ההזמנה נשמרה
                  </p>
                  {bookings.map((b) => (
                    <p key={b.code} className="mt-2 text-cream/90">
                      {b.dateHebrew}, בשעה <span dir="ltr">{b.time}</span>, {b.partySize} סועדים · מספר הזמנה{" "}
                      <span dir="ltr" className="font-mono">{b.code}</span>
                    </p>
                  ))}
                  <p className="mt-3 text-sm text-cream/70">פרטי ההזמנה נשלחו אליכם ב-SMS.</p>
                </div>
              )}
              {bookings === null && (
                <p className="mt-4 text-sm text-cream/70">
                  לא הצלחנו לאמת את מצב ההזמנה. אם הזמנה נשמרה, יישלח אליכם SMS עם הפרטים.
                </p>
              )}
              <button onClick={close} className="mt-8 rounded-full bg-accent px-8 py-3 font-semibold text-white hover:bg-accent-dark">
                חזרה לעמוד המסעדה
              </button>
            </Panel>
          )}
        </div>
      )}
    </>
  );
}

function Aura({ phase }: { phase: Phase }) {
  const color =
    phase === "speaking" ? "bg-accent" : phase === "listening" ? "bg-emerald-500" : phase === "thinking" ? "bg-amber-400" : "bg-cream/40";
  return (
    <div className="relative flex h-48 w-48 items-center justify-center" aria-hidden>
      <span className={`aura-ring absolute inset-0 rounded-full ${color} opacity-40`} />
      <span className={`aura-ring aura-ring-2 absolute inset-0 rounded-full ${color} opacity-40`} />
      <span className={`aura-ring aura-ring-3 absolute inset-0 rounded-full ${color} opacity-40`} />
      <span className={`aura-core relative h-28 w-28 rounded-full ${color} shadow-2xl transition-colors duration-500`} />
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-md text-center">{children}</div>;
}

function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85a1 1 0 0 1-1.41-.02L.29 13.08a1 1 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67a1 1 0 0 1 0 1.41l-2.48 2.47a1 1 0 0 1-1.41.02 11.3 11.3 0 0 0-2.67-1.85 1 1 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
