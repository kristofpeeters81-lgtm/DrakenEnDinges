import { describe, expect, it } from 'vitest';
import { diceNeeded, resolveRoll, rollDice, targetFor, type RollSetup } from './dice';

const setup = (edge: RollSetup['edge'], difficulty: RollSetup['difficulty'] = 'gewoon', helped = false): RollSetup => ({ edge, difficulty, helped });

describe('dobbelregels', () => {
  it('gewoon: 4 of meer is gelukt, 3 of minder mislukt', () => {
    expect(resolveRoll(setup('gewoon'), [4]).success).toBe(true);
    expect(resolveRoll(setup('gewoon'), [3]).success).toBe(false);
  });

  it('héél moeilijk: pas vanaf 5', () => {
    expect(targetFor('moeilijk')).toBe(5);
    expect(resolveRoll(setup('gewoon', 'moeilijk'), [4]).success).toBe(false);
    expect(resolveRoll(setup('gewoon', 'moeilijk'), [5]).success).toBe(true);
  });

  it('goed in: 2 dobbelstenen, de hoogste telt', () => {
    const r = resolveRoll(setup('goed'), [2, 5]);
    expect(r.kept).toBe(5);
    expect(r.keptIndex).toBe(1);
    expect(r.success).toBe(true);
  });

  it('slecht in: 2 dobbelstenen, de laagste telt', () => {
    const r = resolveRoll(setup('slecht'), [6, 2]);
    expect(r.kept).toBe(2);
    expect(r.keptIndex).toBe(1);
    expect(r.success).toBe(false);
  });

  it('samen proberen: helper rolt mee, de hoogste telt', () => {
    const r = resolveRoll(setup('gewoon', 'gewoon', true), [2, 4]);
    expect(r.kept).toBe(4);
    expect(r.keptIndex).toBe(1);
    expect(r.success).toBe(true);
  });

  it('slecht in mét hulp: laagste van de held, daarna de hoogste met de helper', () => {
    const r = resolveRoll(setup('slecht', 'gewoon', true), [6, 1, 3]);
    expect(r.kept).toBe(3);
    expect(r.keptIndex).toBe(2);
    expect(r.success).toBe(false);
  });

  it('bij gelijke stand telt de dobbelsteen van de held', () => {
    expect(resolveRoll(setup('gewoon', 'gewoon', true), [4, 4]).keptIndex).toBe(0);
  });

  it('aantal dobbelstenen klopt voor elke combinatie', () => {
    expect(diceNeeded(setup('gewoon'))).toBe(1);
    expect(diceNeeded(setup('goed'))).toBe(2);
    expect(diceNeeded(setup('slecht', 'moeilijk', true))).toBe(3);
  });

  it('weigert een verkeerd aantal of een onmogelijke worp', () => {
    expect(() => resolveRoll(setup('goed'), [4])).toThrow();
    expect(() => resolveRoll(setup('gewoon'), [7])).toThrow();
    expect(() => resolveRoll(setup('gewoon'), [0])).toThrow();
  });

  it('rollDice geeft altijd waarden van 1 tot 6', () => {
    const many = rollDice(2000);
    expect(many.every((n) => n >= 1 && n <= 6)).toBe(true);
    expect(new Set(many).size).toBe(6);
    expect(rollDice(1, () => 0)).toEqual([1]);
    expect(rollDice(1, () => 0.9999)).toEqual([6]);
  });
});
