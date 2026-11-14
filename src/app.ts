// Gedeelde afspraken tussen de schermen en de controller (main.ts).

import type { Game } from './game/state';
import { escapeHtml } from './ui/dom';

export type Screen = { name: 'home' } | { name: 'heroes' } | { name: 'editor'; heroId: string | null } | { name: 'table' };

export interface App {
  readonly root: HTMLElement;
  /** Het spel dat nu open staat (null op het startscherm). */
  readonly game: Game | null;
  /** Opent een (ander) spel en bewaart het meteen als reservekopie. */
  setGame(game: Game): void;
  go(screen: Screen): void;
  /** Na elke wijziging aan het spel: reservekopie bijwerken en het huidige scherm opnieuw tekenen. */
  changed(): void;
  /** Bewaart het spel als bestand (deelmenu of download). */
  saveToFile(): Promise<void>;
}

/** Het open spel; schermen die een spel nodig hebben worden enkel getoond als er een is. */
export function requireGame(app: App): Game {
  if (!app.game) throw new Error('Geen spel geopend');
  return app.game;
}

/** Bovenbalk met een terugknop links en knoppen rechts. */
export function topbar(title: string, back: { action: string; label: string } | null, right: string): string {
  const backBtn = back ? `<button class="btn ghost back" data-action="${back.action}">‹ ${escapeHtml(back.label)}</button>` : '<span></span>';
  return `<header class="topbar">${backBtn}<h1>${escapeHtml(title)}</h1><div class="topbar-right">${right}</div></header>`;
}

/** Bewaar-knop; valt op zolang er iets veranderd is sinds de laatste keer bewaren als bestand. */
export function saveButton(dirty: boolean): string {
  return `<button class="btn save ${dirty ? 'dirty' : ''}" data-action="save" title="Spel bewaren als bestand">${dirty ? 'Bewaren!' : 'Bewaard'}</button>`;
}
