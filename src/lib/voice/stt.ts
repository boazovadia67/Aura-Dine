"use client";
// Speech-to-text using the browser's Web Speech API (Chrome / Edge support he-IL).
// Kept behind a tiny interface so a cloud STT (Azure / Google) can replace it later.

export interface Recognizer {
  /** Listen for one utterance. Resolves with the final text, or "" on silence. */
  listenOnce(): Promise<string>;
  abort(): void;
}

interface SRResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SRResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

function ctor(): (new () => SR) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return ctor() !== null;
}

export class SttError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export function createRecognizer(lang = "he-IL"): Recognizer {
  const Ctor = ctor();
  if (!Ctor) throw new SttError("unsupported");
  let current: SR | null = null;

  return {
    listenOnce() {
      return new Promise<string>((resolve, reject) => {
        const rec = new Ctor();
        current = rec;
        rec.lang = lang;
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        let text = "";
        let failed = false;
        rec.onresult = (e) => {
          for (let i = 0; i < e.results.length; i++) {
            if (e.results[i].isFinal) text += e.results[i][0].transcript;
          }
        };
        rec.onerror = (e) => {
          if (e.error === "no-speech" || e.error === "aborted") return; // treated as silence
          failed = true;
          reject(new SttError(e.error));
        };
        rec.onend = () => {
          current = null;
          if (!failed) resolve(text.trim());
        };
        rec.start();
      });
    },
    abort() {
      current?.abort();
      current = null;
    },
  };
}
