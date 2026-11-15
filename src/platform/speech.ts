// Voorlezen met de ingebouwde stem van het toestel (geen internet nodig als de stem op de tablet staat).
// Voorkeur: Vlaams (nl-BE), anders Nederlands (nl-NL), anders eender welke nl-stem.

let chosen: SpeechSynthesisVoice | null = null;

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function speechAvailable(): boolean {
  return synth() !== null && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  const by = (lang: string): SpeechSynthesisVoice | undefined => voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang);
  return by('nl-be') ?? by('nl-nl') ?? voices.find((v) => v.lang.toLowerCase().startsWith('nl')) ?? null;
}

/** Sommige toestellen laden hun stemmen pas later: alvast opvragen. */
export function warmUpVoices(): void {
  const s = synth();
  if (!s) return;
  chosen = pickVoice();
  s.addEventListener?.('voiceschanged', () => {
    chosen = pickVoice();
  });
}

/** Leest voor; onderbreekt wat er nu voorgelezen wordt. */
export function speak(text: string): void {
  synth()?.cancel();
  queueSpeech(text);
}

/** Leest voor ná wat er nu voorgelezen wordt (zo lopen actie-gevolg en afloop van de scène netjes na elkaar). */
export function queueSpeech(text: string): void {
  const s = synth();
  if (!s || !text.trim()) return;
  const u = new SpeechSynthesisUtterance(text);
  if (!chosen) chosen = pickVoice();
  if (chosen) u.voice = chosen;
  u.lang = chosen?.lang ?? 'nl-BE';
  u.rate = 0.95;
  s.speak(u);
}

export function stopSpeaking(): void {
  synth()?.cancel();
}
