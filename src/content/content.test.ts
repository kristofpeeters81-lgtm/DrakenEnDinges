// Test de verborgen inhoud ZONDER ze ooit te tonen: enkel vorm en aantallen (ook niet in foutmeldingen).

import { describe, expect, it } from 'vitest';
import { decodeContent, isStringList } from './codec';
import { adventureCount, adventureOutcome, adventureView } from './adventure-view';
import { newAdventure } from '../game/adventure';
import { drawEidastinkt, drawItem, eidastinktCount, getItem, getOpening, itemCount, openingCount } from './index';
import { chapterView, finaleView, seasonCounts } from './season-view';
import { CHAPTERS, MOMENT_SCENE } from '../game/season';

function encode(value: unknown): string {
  let binary = '';
  for (const b of new TextEncoder().encode(JSON.stringify(value))) binary += String.fromCharCode(b);
  return btoa(binary);
}

describe('verborgen inhoud', () => {
  it('decodeert UTF-8 correct (ë, ’, é)', () => {
    const sample = ['Kakofonië', 'Wie ’t riekt', 'Héél moeilijk'];
    const encoded = encode(sample);
    expect(decodeContent(encoded, isStringList)).toEqual(sample);
  });

  it('weigert inhoud met een verkeerde vorm', () => {
    const encoded = encode([1, 2]);
    expect(() => decodeContent(encoded, isStringList)).toThrow();
  });

  it('er zijn minstens 30 beginscènes met titel en tekst', () => {
    const n = openingCount();
    expect(n >= 30).toBe(true);
    let bad = 0;
    for (let i = 0; i < n; i++) {
      const o = getOpening(i);
      if (!o || o.titel.trim().length === 0 || o.titel.length > 40 || o.tekst.length < 200 || o.tekst.length > 650) bad++;
    }
    expect(bad).toBe(0);
    expect(getOpening(n) === null).toBe(true);
  });

  it('seizoensinhoud: elk hoofdstuk heeft 2 scènes met ideeën en alle plaatshouders zijn ingevuld', () => {
    const c = seasonCounts();
    expect(c.villains >= 3).toBe(true);
    let problems = 0;
    for (let v = 0; v < c.villains; v++) {
      const season = {
        villain: v, places: [0, 1, 2, 3], figures: [0, 1, 2], chapter: 0, meter: 0, clues: 0, results: [],
        momentDone: false, scene: 0, rewardTaken: false, keys: [] as boolean[], log: [], hearts: null, heartsStart: null, finished: false,
      };
      for (let ch = 0; ch < CHAPTERS; ch++) {
        season.chapter = ch;
        // Alle 4 paden: gelukt/mislukt bij elk sleutelmoment
        for (const keys of [[true, true], [true, false], [false, true], [false, false]]) {
          season.keys = keys;
          const view = chapterView(season);
          const sceneTexts = view.scenes.reduce<string[]>(
            (acc, s) => acc.concat([s.tekst, s.doel, s.gelukt, s.mislukt], s.acties.reduce<string[]>((a2, x) => a2.concat([x.label, x.past, x.gelukt, x.mislukt]), [])),
            [],
          );
          const texts = [view.titel, view.doel, view.moment ?? '', ...sceneTexts];
          if (view.scenes.length !== MOMENT_SCENE || view.moment === null || view.scenes.some((s) => s.acties.length < 8)) problems++;
          problems += texts.filter((t) => /\{\w+\}/.test(t)).length;
        }
      }
      season.chapter = CHAPTERS;
      if (/\{\w+\}/.test(finaleView(season).tekst)) problems++;
    }
    expect(problems).toBe(0);
  });

  it('voorwerpen: minstens 30, met naam en beschrijving, en nooit een dubbel trekken', () => {
    const n = itemCount();
    expect(n >= 30).toBe(true);
    let bad = 0;
    for (let i = 0; i < n; i++) {
      const it = getItem(i);
      if (!it || it.naam.trim().length === 0 || it.naam.length > 40 || it.beschrijving.length < 40) bad++;
    }
    expect(bad).toBe(0);
    const owned: number[] = [];
    for (let i = 0; i < n; i++) {
      const pick = drawItem(owned);
      expect(pick !== null && !owned.includes(pick)).toBe(true);
      if (pick !== null) owned.push(pick);
    }
    expect(drawItem(owned)).toBeNull();
  });

  it('losse avonturen: minstens 15, en elk pad (begin/wending gelukt of mislukt) heeft scènes, acties en een moment', () => {
    const n = adventureCount();
    expect(n >= 15).toBe(true);
    let problems = 0;
    for (let i = 0; i < n; i++) {
      for (const keys of [[true, true], [true, false], [false, true], [false, false]]) {
        const adv = { ...newAdventure(i), keys };
        const view = adventureView(adv);
        if (view.scenes.length !== 2 || view.moment === null || view.scenes.some((s) => s.acties.length < 8 || s.doel.length < 10)) problems++;
        if (adventureOutcome(adv, true).length < 40 || adventureOutcome(adv, false).length < 40) problems++;
      }
    }
    expect(problems).toBe(0);
  });

  it('er zijn genoeg Eidastinkt-voorvallen', () => {
    expect(eidastinktCount() >= 30).toBe(true);
  });

  it('trekt alle voorvallen één keer voor er eentje terugkomt', () => {
    const n = eidastinktCount();
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) seen.add(drawEidastinkt());
    expect(seen.size === n).toBe(true);
  });

  it('elk voorval is kort genoeg om voor te lezen', () => {
    const n = eidastinktCount();
    let tooLong = 0;
    for (let i = 0; i < n; i++) if (drawEidastinkt().length > 300) tooLong++;
    expect(tooLong).toBe(0);
  });
});
