"use client";
// Text-to-speech using the browser's speechSynthesis. Replaceable by a cloud TTS later.

export interface Speaker {
  speak(text: string): Promise<void>;
  cancel(): void;
  hasHebrewVoice(): boolean;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const v = speechSynthesis.getVoices();
    if (v.length) return resolve(v);
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Prefer natural/online Hebrew voices (Edge ships good ones), then any he-IL voice. */
function pickVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const he = voices.filter((v) => v.lang.toLowerCase().startsWith("he") || v.lang.toLowerCase().startsWith("iw"));
  return (
    he.find((v) => /natural|online|neural/i.test(v.name)) ??
    he.find((v) => /google/i.test(v.name)) ??
    he[0] ??
    null
  );
}

/** Chrome cuts off long utterances, so speak sentence by sentence. */
function chunks(text: string): string[] {
  return text
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createSpeaker(lang = "he-IL"): Promise<Speaker> {
  const voice = pickVoice(await loadVoices());
  let cancelled = false;

  const speakOne = (t: string) =>
    new Promise<void>((resolve) => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = lang;
      if (voice) u.voice = voice;
      u.rate = 1.05;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });

  return {
    async speak(text) {
      cancelled = false;
      for (const c of chunks(text)) {
        if (cancelled) return;
        await speakOne(c);
      }
    },
    cancel() {
      cancelled = true;
      speechSynthesis.cancel();
    },
    hasHebrewVoice: () => voice !== null,
  };
}
