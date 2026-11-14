// Test de verborgen inhoud ZONDER ze ooit te tonen: enkel vorm en aantallen (ook niet in foutmeldingen).

import { describe, expect, it } from 'vitest';
import { decodeContent, isStringList } from './codec';
import { drawEidastinkt, eidastinktCount } from './index';

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
