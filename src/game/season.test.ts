import { describe, expect, it } from 'vitest';
import {
  advanceChapter,
  advanceScene,
  actionFailed,
  actionSucceeded,
  canAct,
  keyDone,
  MAX_LEAD,
  OWN_IDEA,
  recordAction,
  SCENE_TURNS,
  sceneProgress,
  turnsLeft,
  leadTotal,
  CHAPTERS,
  finaleHearts,
  finaleRound,
  isFinale,
  METER_MAX,
  neededSuccesses,
  newSeason,
  resolveMoment,
  rollerCount,
  startFinale,
} from './season';

const counts = { villains: 3, places: 8, figures: 6 };

describe('seizoen kiezen', () => {
  it('kiest een slechterik, 4 verschillende plaatsen en 3 verschillende figuren', () => {
    const s = newSeason([], counts);
    expect(s.villain).toBeGreaterThanOrEqual(0);
    expect(s.villain).toBeLessThan(3);
    expect(new Set(s.places).size).toBe(4);
    expect(new Set(s.figures).size).toBe(3);
    expect(s.chapter).toBe(0);
    expect(s.meter).toBe(0);
  });

  it('kiest een slechterik die nog niet gespeeld is', () => {
    for (let i = 0; i < 30; i++) expect(newSeason([0, 2], counts).villain).toBe(1);
  });

  it('zijn ze allemaal geweest, dan mag er opnieuw eentje komen', () => {
    expect(() => newSeason([0, 1, 2], counts)).not.toThrow();
  });

  it('weigert als er te weinig inhoud is', () => {
    expect(() => newSeason([], { villains: 1, places: 2, figures: 3 })).toThrow();
  });

  it('bouwstenen + toeval: verschillende seizoenen zien er verschillend uit', () => {
    const shapes = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const s = newSeason([], counts);
      shapes.add(`${s.villain}|${s.places.join(',')}|${s.figures.join(',')}`);
    }
    expect(shapes.size).toBeGreaterThan(30);
  });
});

describe('beslissend moment', () => {
  it('met 1 of 2 helden rolt er een bondgenoot mee', () => {
    expect(rollerCount(1)).toBe(2);
    expect(rollerCount(2)).toBe(3);
    expect(rollerCount(3)).toBe(3);
    expect(rollerCount(6)).toBe(6);
  });

  it('nodige successen: de helft, +1 als de meter op 3 of meer staat', () => {
    expect(neededSuccesses(3, 0)).toBe(2);
    expect(neededSuccesses(4, 0)).toBe(2);
    expect(neededSuccesses(4, 3)).toBe(3);
    expect(neededSuccesses(2, 6)).toBe(2);
  });

  it('alles gelukt: meter zakt en aanwijzing', () => {
    const s = newSeason([], counts);
    s.meter = 2;
    expect(resolveMoment(s, 3, 3)).toBe('perfect');
    expect(s.meter).toBe(1);
    expect(s.clues).toBe(1);
  });

  it('genoeg gelukt: aanwijzing, meter blijft', () => {
    const s = newSeason([], counts);
    expect(resolveMoment(s, 2, 3)).toBe('gehaald');
    expect(s.meter).toBe(0);
    expect(s.clues).toBe(1);
  });

  it('mislukt: meter +2, geen aanwijzing, nooit boven het maximum', () => {
    const s = newSeason([], counts);
    s.meter = 5;
    expect(resolveMoment(s, 0, 3)).toBe('mislukt');
    expect(s.meter).toBe(METER_MAX);
    expect(s.clues).toBe(0);
  });

  it('maar één beslissend moment per hoofdstuk', () => {
    const s = newSeason([], counts);
    resolveMoment(s, 3, 3);
    expect(() => resolveMoment(s, 3, 3)).toThrow();
  });

  it('pas na het beslissende moment naar het volgende hoofdstuk', () => {
    const s = newSeason([], counts);
    advanceChapter(s);
    expect(s.chapter).toBe(0);
    resolveMoment(s, 2, 3);
    advanceChapter(s);
    expect(s.chapter).toBe(1);
    expect(s.momentDone).toBe(false);
  });

  it('na 3 hoofdstukken komt de finale', () => {
    const s = newSeason([], counts);
    for (let i = 0; i < CHAPTERS; i++) {
      resolveMoment(s, 2, 3);
      advanceChapter(s);
    }
    expect(isFinale(s)).toBe(true);
  });
});

describe('scènes met acties', () => {
  const act = (s: ReturnType<typeof newSeason>, action: number, success: boolean) => recordAction(s, { hero: 'Anna', action, text: '', success });

  it('2 gelukte acties = scène gelukt, daarna verder naar de wending', () => {
    const s = newSeason([], counts);
    expect(act(s, 0, true)).toBeNull();
    expect(sceneProgress(s)).toBe(1);
    expect(act(s, 3, true)).toBe(true);
    expect(keyDone(s)).toBe(true);
    advanceScene(s);
    expect(s.scene).toBe(1);
    expect(sceneProgress(s)).toBe(0);
    expect(turnsLeft(s)).toBe(SCENE_TURNS);
  });

  it('beurten op zonder 2 successen = scène mislukt', () => {
    const s = newSeason([], counts);
    act(s, 0, false);
    act(s, 1, true);
    act(s, 2, false);
    act(s, 0, false);
    expect(act(s, 4, false)).toBe(false);
    expect(s.keys).toEqual([false]);
    expect(canAct(s)).toBe(false);
  });

  it('een mislukte actie mag opnieuw, een gelukte niet', () => {
    const s = newSeason([], counts);
    act(s, 2, false);
    expect(actionFailed(s, 2)).toBe(true);
    expect(actionSucceeded(s, 2)).toBe(false);
    act(s, 2, true);
    expect(actionSucceeded(s, 2)).toBe(true);
    expect(() => act(s, 2, true)).toThrow();
  });

  it('eigen ideeën mogen altijd, en de tekst wordt onthouden (ingekort)', () => {
    const s = newSeason([], counts);
    recordAction(s, { hero: 'Anna', action: OWN_IDEA, text: 'x'.repeat(200), success: true });
    recordAction(s, { hero: 'Papa', action: OWN_IDEA, text: 'nog eens', success: false });
    expect(s.log[0].text.length).toBe(120);
    expect(s.log[1].hero).toBe('Papa');
  });

  it('nieuw hoofdstuk begint met een leeg logboek', () => {
    const s = newSeason([], counts);
    act(s, 0, true);
    act(s, 1, true);
    advanceScene(s);
    resolveMoment(s, 3, 3);
    advanceChapter(s);
    expect(s.log).toEqual([]);
    expect(s.keys).toEqual([]);
  });

  it('geen acties na het beslissende moment of in de finale', () => {
    const s = newSeason([], counts);
    resolveMoment(s, 3, 3);
    expect(canAct(s)).toBe(false);
    s.chapter = CHAPTERS;
    s.momentDone = false;
    s.scene = 0;
    expect(canAct(s)).toBe(false);
  });
});

describe('voorsprong uit gelukte scènes', () => {
  it('1 ster per gelukt sleutelmoment, +1 als ze allebei lukten', () => {
    const a = newSeason([], counts);
    a.keys = [true, false];
    expect(leadTotal(a)).toBe(1);
    const b = newSeason([], counts);
    b.keys = [true, true];
    expect(leadTotal(b)).toBe(MAX_LEAD);
    const c = newSeason([], counts);
    c.keys = [false, false];
    expect(leadTotal(c)).toBe(0);
  });

  it('een goede avond kan niet meer mislukken door slechte worpen op het einde', () => {
    const s = newSeason([], counts);
    s.keys = [true, true];
    expect(resolveMoment(s, 0, 3)).toBe('perfect');
  });

  it('half goed + slechte worpen: toch gehaald', () => {
    const s = newSeason([], counts);
    s.keys = [true, false];
    expect(resolveMoment(s, 1, 3)).toBe('gehaald');
  });

  it('zonder voorsprong beslissen de dobbelstenen', () => {
    const s = newSeason([], counts);
    s.keys = [false, false];
    expect(resolveMoment(s, 1, 3)).toBe('mislukt');
  });

});

describe('finale', () => {
  it('meer levens bij een hoge meter, minder per aanwijzing, altijd minstens 1', () => {
    expect(finaleHearts(0, 3, 3)).toBe(1);
    expect(finaleHearts(6, 0, 3)).toBe(5);
    expect(finaleHearts(6, 0, 5)).toBe(6);
    expect(finaleHearts(0, 0, 2)).toBe(2);
  });

  it('rondes tot de slechterik verslagen is: altijd winbaar', () => {
    const s = newSeason([], counts);
    s.chapter = CHAPTERS;
    s.meter = 6;
    startFinale(s, 3);
    expect(s.hearts).toBe(5);
    expect(finaleRound(s, 0)).toBe(false);
    expect(finaleRound(s, 2)).toBe(false);
    expect(s.hearts).toBe(3);
    expect(finaleRound(s, 5)).toBe(true);
    expect(s.hearts).toBe(0);
    expect(s.finished).toBe(true);
  });

  it('de finale start maar één keer', () => {
    const s = newSeason([], counts);
    s.chapter = CHAPTERS;
    startFinale(s, 3);
    const h = s.hearts;
    s.meter = 6;
    startFinale(s, 3);
    expect(s.hearts).toBe(h);
  });
});
