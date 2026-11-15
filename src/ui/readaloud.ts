// Voorleesmodus: "om de beurt" (wie aan de beurt is leest voor, soms met een gek stemmetje) of "app-stem".
// De keuze is een voorkeur van dit toestel (localStorage); het spelbestand verandert er niet door.

import { currentHero, type Game } from '../game/state';
import { queueSpeech, speak, speechAvailable, stopSpeaking } from '../platform/speech';
import { escapeHtml } from './dom';

export type ReadMode = 'beurt' | 'stem';

const KEY = 'dd.voorlezen';

export const VOICE_TASKS = [
  'met de stem van een verkouden trol',
  'als een nieuwslezer op tv',
  'heel deftig, zoals Lord Water Closet',
  'fluisterend, alsof het een groot geheim is',
  'als een piraat. Arrr!',
  'zo traag als een slak',
  'met een kippenstem. Tok!',
  'alsof ge héél bang zijt',
  'als een robot. Biep.',
  'zingend, als een opera',
] as const;

export function readMode(): ReadMode {
  try {
    return localStorage.getItem(KEY) === 'stem' ? 'stem' : 'beurt';
  } catch {
    return 'beurt';
  }
}

export function setReadMode(mode: ReadMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Geen opslag: de keuze geldt enkel tot de app herladen wordt.
  }
}

/** Vaste "toevalswaarde" per tekst, zodat het stemmetje niet verandert bij elk hertekenen van het scherm. */
function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const texts = new Map<string, string>();
/** Teksten die al vanzelf voorgelezen zijn (zodat hertekenen van het scherm ze niet opnieuw voorleest). */
const autoRead = new Set<string>();

function voiceOn(): boolean {
  return readMode() === 'stem' && speechAvailable();
}

/**
 * Voorleesbalkje bij een verhaaltekst.
 * - app-stem: de tekst wordt vanzelf voorgelezen zodra hij verschijnt; knoppen "Nog eens" en "Stil"
 *   (de tekst wordt bewaard in een register, niet in de HTML-attributen).
 * - om de beurt: wie leest er voor, en 1 op 3 keer met een gek stemmetje.
 */
export function readBar(text: string, reader: string | null): string {
  if (!text.trim()) return '';
  if (voiceOn()) {
    const key = String(hash(text));
    texts.set(key, text);
    return `<div class="read-bar"><button class="btn small read-btn" data-read="${key}">🔊 Nog eens</button>
      <button class="btn small ghost hush-btn" data-hush="1">⏹ Stil</button></div>`;
  }
  if (!reader) return '';
  const h = hash(text);
  const task = h % 3 === 0 ? ` <span class="voice-task">— ${escapeHtml(VOICE_TASKS[h % VOICE_TASKS.length])}</span>` : '';
  return `<div class="read-bar"><span class="reader">📖 Voorlezer: <b>${escapeHtml(reader)}</b>${task}</span></div>`;
}

/** Wie leest er voor? De speler van de held die aan de beurt is (of de held zelf als er geen speler ingevuld is). */
export function readerOf(game: Game): string | null {
  const hero = currentHero(game);
  return hero ? hero.player || hero.name : null;
}

/** Met de app-stem: leest een korte melding voor (bv. het gevolg van een actie), na wat er al voorgelezen wordt. */
export function narrate(text: string): void {
  if (voiceOn()) queueSpeech(text);
}

/** Leest elke nieuwe verhaaltekst op het scherm vanzelf voor (in volgorde), één keer per tekst. */
function readNewTexts(): void {
  if (!voiceOn()) return;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>('[data-read]'))) {
    const key = el.dataset.read ?? '';
    const text = texts.get(key);
    if (!text || autoRead.has(key)) continue;
    autoRead.add(key);
    queueSpeech(text);
  }
}

/** Eén klik-luisteraar voor alle voorleesknoppen (ook in vensters bovenop het scherm) + vanzelf voorlezen. */
export function installReadAloud(): void {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-hush]')) {
      stopSpeaking();
      return;
    }
    const btn = target.closest<HTMLElement>('[data-read]');
    if (!btn) return;
    const text = texts.get(btn.dataset.read ?? '');
    if (text) speak(text);
  });
  new MutationObserver(readNewTexts).observe(document.body, { childList: true, subtree: true });
}
