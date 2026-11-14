import { describe, expect, it } from 'vitest';
import { ANSWER_TEXTS, PROMPT_ADJECTIVES, PROMPT_NOUNS, quipFor, zottePrikkel } from '../data/oracle-texts';
import { ANSWERS, askOracle, isYes, oracleDiceCount, wantsPrompt } from './oracle';

describe('het orakel', () => {
  it('volgt de tabel van de regelkaart', () => {
    expect([1, 2, 3, 4, 5, 6].map((d) => askOracle('gewoon', [d]).answer)).toEqual(['nee-en', 'nee', 'nee-maar', 'ja-maar', 'ja', 'ja-en']);
  });

  it('waarschijnlijk: 2 dobbelstenen, de hoogste telt', () => {
    const o = askOracle('waarschijnlijk', [2, 5]);
    expect(o.keptIndex).toBe(1);
    expect(o.answer).toBe('ja');
  });

  it('onwaarschijnlijk: 2 dobbelstenen, de laagste telt', () => {
    const o = askOracle('onwaarschijnlijk', [6, 3]);
    expect(o.keptIndex).toBe(1);
    expect(o.answer).toBe('nee-maar');
  });

  it('aantal dobbelstenen per kans', () => {
    expect(oracleDiceCount('gewoon')).toBe(1);
    expect(oracleDiceCount('waarschijnlijk')).toBe(2);
    expect(oracleDiceCount('onwaarschijnlijk')).toBe(2);
  });

  it('weigert een verkeerd aantal of een onmogelijke worp', () => {
    expect(() => askOracle('gewoon', [1, 2])).toThrow();
    expect(() => askOracle('waarschijnlijk', [7, 1])).toThrow();
  });

  it('ja/nee en wanneer er een prikkel bij hoort', () => {
    expect(ANSWERS.filter(isYes)).toEqual(['ja-maar', 'ja', 'ja-en']);
    expect(ANSWERS.filter(wantsPrompt)).toEqual(['nee-en', 'nee-maar', 'ja-maar', 'ja-en']);
  });

  it('elk antwoord heeft een label, uitleg en minstens één grapje', () => {
    for (const a of ANSWERS) {
      expect(ANSWER_TEXTS[a].label.length).toBeGreaterThan(0);
      expect(ANSWER_TEXTS[a].meaning.length).toBeGreaterThan(0);
      expect(quipFor(a).length).toBeGreaterThan(0);
    }
  });

  it('zotte prikkel: de eerste 6 woorden zijn die van de regelkaart', () => {
    expect(PROMPT_ADJECTIVES.slice(0, 6)).toEqual(['natte', 'piepende', 'stinkende', 'gouden', 'boze', 'dansende']);
    expect(PROMPT_NOUNS.slice(0, 6)).toEqual(['sok', 'kip', 'pollepel', 'wc-rol', 'nonkel', 'pannenkoek']);
    expect(zottePrikkel(() => 0)).toEqual({ adjective: 'natte', noun: 'sok' });
  });

  it('zotte prikkel: 40 × 40 verschillende woorden = 1600 combinaties', () => {
    expect(new Set(PROMPT_ADJECTIVES).size).toBe(40);
    expect(new Set(PROMPT_NOUNS).size).toBe(40);
  });

  it('zotte prikkel: nooit twee keer na elkaar dezelfde', () => {
    let prev = '';
    for (let i = 0; i < 500; i++) {
      const p = zottePrikkel();
      const key = `${p.adjective} ${p.noun}`;
      expect(key).not.toBe(prev);
      prev = key;
    }
  });
});
