// Groei van de helden: level-up na elke sessie (1 uit 3 beloningskaarten), titels, maatjes en gasten op groepsniveau.

import { BUDDIES, TITLES, type HeroStats } from '../data/growth-data';

export const MAX_LEVEL = 10;
export const MAX_EXTRA_GOOD = 2;
export const MAX_POWER_USES = 2;
export const MAX_BONUS_FRIES = 2;
export const MAX_ITEM_LEVEL = 3;
export const MAX_BUDDY_STAGE = 3;

export type CardKind = 'talent' | 'kracht' | 'frietzak' | 'voorwerp' | 'maatje' | 'trucje';

export interface Buddy {
  /** Nummer in BUDDIES. */
  kind: number;
  name: string;
  /** 1 = klein, 2 = groter, 3 = straf: zoveel keer per sessie kan het maatje helpen. */
  stage: number;
  usedCount: number;
}

/** Wat de groei van een held nodig heeft (deel van Hero in state.ts). */
export interface Growable {
  level: number;
  pendingLevelUps: number;
  extraGood: string[];
  powerMax: number;
  bonusFries: number;
  items: Array<{ item: number; level: number; usedCount: number }>;
  buddy: Buddy | null;
  stats: HeroStats;
  titles: string[];
}

export const CARD_TEXT: Record<CardKind, { titel: string; uitleg: string }> = {
  talent: { titel: 'Nieuw talent', uitleg: 'Een extra “goed in”.' },
  kracht: { titel: 'Sterkere kracht', uitleg: 'Uw speciale kracht mag 2× per sessie.' },
  frietzak: { titel: 'Grotere frietzak', uitleg: 'Elke sessie 1 frietje meer bij de start.' },
  voorwerp: { titel: 'Voorwerp oppoetsen', uitleg: 'Een voorwerp wordt sterker: het mag 1× extra per sessie.' },
  maatje: { titel: 'Een maatje!', uitleg: 'Een zot dier gaat met u mee. 1× per sessie helpt het bij een worp.' },
  trucje: { titel: 'Maatje leert een trucje', uitleg: 'Uw maatje groeit: het mag 1× extra per sessie helpen.' },
};

export function availableCards(h: Growable): CardKind[] {
  const out: CardKind[] = [];
  if (h.extraGood.length < MAX_EXTRA_GOOD) out.push('talent');
  if (h.powerMax < MAX_POWER_USES) out.push('kracht');
  if (h.bonusFries < MAX_BONUS_FRIES) out.push('frietzak');
  if (h.items.some((i) => i.level < MAX_ITEM_LEVEL)) out.push('voorwerp');
  if (!h.buddy) out.push('maatje');
  else if (h.buddy.stage < MAX_BUDDY_STAGE) out.push('trucje');
  return out;
}

/** 3 verschillende kaarten om uit te kiezen (minder als er minder mogelijk zijn). */
export function offerCards(h: Growable, rng: () => number = Math.random): CardKind[] {
  const all = availableCards(h);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 3);
}

export interface CardChoice {
  /** talent: het nieuwe "goed in". */
  talent?: string;
  /** voorwerp: welk vak in de rugzak. */
  slot?: number;
  /** maatje: welk dier (nummer in BUDDIES). */
  buddyKind?: number;
}

/** Past een beloningskaart toe. Geeft een foutmelding terug, of null als het gelukt is. */
export function applyCard(h: Growable, card: CardKind, choice: CardChoice = {}): string | null {
  if (h.pendingLevelUps <= 0) return 'Er is geen level-up meer te kiezen.';
  if (!availableCards(h).includes(card)) return 'Deze beloning kan niet meer.';
  switch (card) {
    case 'talent': {
      const t = (choice.talent ?? '').trim();
      if (!t) return 'Kies een nieuw talent.';
      h.extraGood.push(t.slice(0, 80));
      break;
    }
    case 'kracht':
      h.powerMax += 1;
      break;
    case 'frietzak':
      h.bonusFries += 1;
      break;
    case 'voorwerp': {
      const it = choice.slot === undefined ? undefined : h.items[choice.slot];
      if (!it || it.level >= MAX_ITEM_LEVEL) return 'Kies een voorwerp om op te poetsen.';
      it.level += 1;
      break;
    }
    case 'maatje': {
      const k = choice.buddyKind ?? -1;
      if (k < 0 || k >= BUDDIES.length) return 'Kies een maatje.';
      h.buddy = { kind: k, name: BUDDIES[k].naam, stage: 1, usedCount: 0 };
      break;
    }
    case 'trucje':
      if (h.buddy) h.buddy.stage += 1;
      break;
  }
  h.pendingLevelUps -= 1;
  h.level = Math.min(MAX_LEVEL, h.level + 1);
  return null;
}

/** Na een sessie: elke held die meespeelde krijgt een level-up (tot het maximum). */
export function grantLevelUp(h: Growable): void {
  if (h.level + h.pendingLevelUps < MAX_LEVEL) h.pendingLevelUps += 1;
}

/** Nieuwe titels die deze held nu verdiend heeft (en die worden meteen toegevoegd). */
export function checkTitles(h: Growable): string[] {
  const fresh = TITLES.filter((t) => !h.titles.includes(t.id) && t.earned(h.stats)).map((t) => t.id);
  h.titles.push(...fresh);
  return fresh;
}

export function titleName(id: string): string {
  return TITLES.find((t) => t.id === id)?.naam ?? id;
}

/** Gemiddeld niveau van de groep (naar beneden afgerond, minstens 1). */
export function groupLevel(levels: readonly number[]): number {
  if (levels.length === 0) return 1;
  return Math.max(1, Math.floor(levels.reduce((a, b) => a + b, 0) / levels.length));
}

/** Hoeveel keer per sessie mag dit voorwerp? roestig 1×, blinkend 2×, legendarisch 3×. */
export function itemUses(level: number): number {
  return Math.max(1, Math.min(MAX_ITEM_LEVEL, level));
}

export const ITEM_LEVEL_NAMES = ['roestig', 'blinkend', 'legendarisch'] as const;
