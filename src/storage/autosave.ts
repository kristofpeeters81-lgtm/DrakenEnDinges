// Automatische reservekopie in de browser: enkel een vangnet bij een crash midden in een sessie.
// Het echte bewaren gebeurt als bestand (zie platform/file.ts) — browsergegevens kunnen verdwijnen.

import { parseGame, serializeGame } from '../game/save';
import type { Game } from '../game/state';

const KEY = 'dd.autosave';

export function writeAutosave(game: Game): boolean {
  try {
    localStorage.setItem(KEY, serializeGame(game));
    return true;
  } catch {
    return false;
  }
}

export function readAutosave(): Game | null {
  try {
    const text = localStorage.getItem(KEY);
    return text ? parseGame(text) : null;
  } catch {
    return null;
  }
}

/** Vraagt de browser om de opslag niet zomaar op te ruimen (best effort, geen garantie). */
export function requestPersistence(): void {
  try {
    void navigator.storage?.persist?.();
  } catch {
    // Niet ondersteund: geen probleem, het bestand is de echte bewaarplaats.
  }
}
