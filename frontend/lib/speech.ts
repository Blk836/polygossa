// Pronunciation audio via the browser's built-in speech synthesis (no API cost, works offline on most devices).

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speak(text: string, locale: string, rate = 0.9) {
  if (!canSpeak()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locale;
  utterance.rate = rate;
  const lang = locale.split("-")[0];
  const voice =
    synth.getVoices().find((v) => v.lang === locale) ?? synth.getVoices().find((v) => v.lang.startsWith(lang));
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}
