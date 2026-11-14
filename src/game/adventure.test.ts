import { describe, expect, it } from 'vitest';
import { newAdventure, resolveAdventureMoment } from './adventure';
import { advanceScene, canActIn, recordAction, turnsLeft } from './season';

describe('los avontuur (mini-hoofdstuk)', () => {
  const act = (a: ReturnType<typeof newAdventure>, action: number, success: boolean) => recordAction(a, { hero: 'Anna', action, text: '', success });

  it('dezelfde regels als een hoofdstuk: begin → wending → beslissend moment', () => {
    const a = newAdventure(3);
    act(a, 0, true);
    expect(act(a, 1, true)).toBe(true);
    advanceScene(a);
    expect(a.scene).toBe(1);
    expect(turnsLeft(a)).toBe(5);
    for (let i = 0; i < 5; i++) act(a, 0, false);
    expect(a.keys).toEqual([true, false]);
    advanceScene(a);
    expect(canActIn(a)).toBe(false);
    expect(resolveAdventureMoment(a, 1, 3)).toBe('gehaald');
    expect(a.momentDone).toBe(true);
  });

  it('het beslissende moment kan maar één keer', () => {
    const a = newAdventure(0);
    resolveAdventureMoment(a, 3, 3);
    expect(() => resolveAdventureMoment(a, 3, 3)).toThrow();
  });

  it('geen meter: met voorsprong en slechte worpen toch gehaald, zonder voorsprong mislukt', () => {
    const good = newAdventure(0);
    good.keys = [true, true];
    expect(resolveAdventureMoment(good, 0, 3)).toBe('perfect');
    const bad = newAdventure(0);
    bad.keys = [false, false];
    expect(resolveAdventureMoment(bad, 1, 3)).toBe('mislukt');
  });
});
