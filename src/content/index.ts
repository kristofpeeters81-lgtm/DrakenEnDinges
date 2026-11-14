// Toegang tot de verborgen inhoud. Alles wordt pas gedecodeerd op het moment dat het nodig is.

import { decodeContent, isStringList } from './codec';
import { DATA as BEGINSCENES } from './beginscenes.data';
import { DATA as EIDASTINKT } from './eidastinkt.data';

export interface Opening {
  titel: string;
  tekst: string;
}

function isOpeningList(v: unknown): v is Opening[] {
  return (
    Array.isArray(v) &&
    v.every((o: unknown) => typeof o === 'object' && o !== null && typeof (o as Opening).titel === 'string' && typeof (o as Opening).tekst === 'string')
  );
}

let openings: Opening[] | null = null;

function allOpenings(): Opening[] {
  if (!openings) openings = decodeContent(BEGINSCENES, isOpeningList);
  return openings;
}

export function openingCount(): number {
  return allOpenings().length;
}

/** De beginscène met dit nummer, of null als die niet (meer) bestaat. */
export function getOpening(index: number | null): Opening | null {
  if (index === null) return null;
  return allOpenings()[index] ?? null;
}

let events: string[] | null = null;
let deck: number[] = [];

function eidastinktEvents(): string[] {
  if (!events) events = decodeContent(EIDASTINKT, isStringList);
  return events;
}

/** Trekt een willekeurig Eidastinkt-voorval; pas als alles geweest is, komen ze opnieuw (in een andere volgorde). */
export function drawEidastinkt(rng: () => number = Math.random): string {
  const all = eidastinktEvents();
  if (deck.length === 0) {
    deck = all.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }
  const index = deck.pop();
  return all[index ?? 0];
}

/** Aantal voorvallen (voor tests, zonder de inhoud te tonen). */
export function eidastinktCount(): number {
  return eidastinktEvents().length;
}
