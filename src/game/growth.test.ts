import { describe, expect, it } from 'vitest';
import { GUESTS } from '../data/growth-data';
import { POWERS } from '../data/ideas';
import { availableCards, groupLevel, offerCards } from './growth';
import { finaleHearts } from './season';
import {
  addGuest,
  addHero,
  canUseBuddy,
  canUsePower,
  chooseLevelCard,
  eatFry,
  emptyDraft,
  endSession,
  giveItem,
  newGame,
  setPech,
  startSession,
  takeTitleNews,
  useBuddy,
  useItem,
  usePower,
  type HeroDraft,
} from './state';

function draft(name: string): HeroDraft {
  return { ...emptyDraft(), name, player: 'Papa', kind: 'Trol', goodAt: ['Klimmen', 'Koken'], badAt: 'Tellen', power: POWERS[0] };
}

function playedSession() {
  const g = newGame();
  const a = addHero(g, draft('A'));
  const b = addHero(g, draft('B'));
  startSession(g);
  endSession(g);
  return { g, a, b };
}

describe('level-up na een sessie', () => {
  it('elke held die meespeelde krijgt een level-up om te kiezen', () => {
    const { a, b } = playedSession();
    expect(a.pendingLevelUps).toBe(1);
    expect(b.pendingLevelUps).toBe(1);
  });

  it('wie niet meespeelde, krijgt niets', () => {
    const g = newGame();
    const a = addHero(g, draft('A'));
    const b = addHero(g, draft('B'));
    b.present = false;
    startSession(g);
    endSession(g);
    expect(a.pendingLevelUps).toBe(1);
    expect(b.pendingLevelUps).toBe(0);
  });

  it('3 verschillende kaarten om uit te kiezen', () => {
    const { a } = playedSession();
    const cards = offerCards(a);
    expect(cards.length).toBe(3);
    expect(new Set(cards).size).toBe(3);
  });

  it('nieuw talent: extra "goed in", niveau omhoog', () => {
    const { g, a } = playedSession();
    expect(chooseLevelCard(g, a.id, 'talent', { talent: 'Dansen' })).toBeNull();
    expect(a.extraGood).toEqual(['Dansen']);
    expect(a.level).toBe(2);
    expect(a.pendingLevelUps).toBe(0);
  });

  it('zonder openstaande level-up kan je niets kiezen', () => {
    const { g, a } = playedSession();
    chooseLevelCard(g, a.id, 'frietzak');
    expect(chooseLevelCard(g, a.id, 'frietzak')).not.toBeNull();
  });

  it('grotere frietzak: meer frietjes bij de start van elke sessie', () => {
    const { g, a } = playedSession();
    chooseLevelCard(g, a.id, 'frietzak');
    startSession(g);
    expect(a.fries).toBe(4);
  });

  it('sterkere kracht: 2× per sessie', () => {
    const { g, a } = playedSession();
    chooseLevelCard(g, a.id, 'kracht');
    startSession(g);
    expect(usePower(g, a.id)).toBe(true);
    expect(canUsePower(a)).toBe(true);
    expect(usePower(g, a.id)).toBe(true);
    expect(usePower(g, a.id)).toBe(false);
  });

  it('voorwerp oppoetsen: mag vaker per sessie', () => {
    const { g, a } = playedSession();
    giveItem(g, a.id, 0);
    expect(availableCards(a)).toContain('voorwerp');
    chooseLevelCard(g, a.id, 'voorwerp', { slot: 0 });
    startSession(g);
    expect(useItem(g, a.id, 0)).toBe(true);
    expect(useItem(g, a.id, 0)).toBe(true);
    expect(useItem(g, a.id, 0)).toBe(false);
  });

  it('maatje: helpt zoveel keer per sessie als zijn stadium', () => {
    const { g, a } = playedSession();
    chooseLevelCard(g, a.id, 'maatje', { buddyKind: 2 });
    expect(a.buddy?.stage).toBe(1);
    startSession(g);
    expect(useBuddy(g, a.id)).toBe(true);
    expect(canUseBuddy(a)).toBe(false);
    endSession(g);
    expect(availableCards(a)).toContain('trucje');
    chooseLevelCard(g, a.id, 'trucje');
    startSession(g);
    expect(useBuddy(g, a.id)).toBe(true);
    expect(useBuddy(g, a.id)).toBe(true);
    expect(useBuddy(g, a.id)).toBe(false);
  });

  it('maxima: kaarten verdwijnen als ze op hun maximum zitten', () => {
    const { g, a } = playedSession();
    a.pendingLevelUps = 5;
    chooseLevelCard(g, a.id, 'kracht');
    chooseLevelCard(g, a.id, 'frietzak');
    chooseLevelCard(g, a.id, 'frietzak');
    expect(availableCards(a)).not.toContain('kracht');
    expect(availableCards(a)).not.toContain('frietzak');
  });
});

describe('gasten en groepsniveau', () => {
  it('een nieuwe held start op het niveau van de groep (level-ups meteen te kiezen)', () => {
    const { g, a, b } = playedSession();
    a.level = 4;
    b.level = 4;
    const c = addHero(g, draft('C'));
    expect(c.level).toBe(1);
    expect(c.pendingLevelUps).toBe(3);
  });

  it('kant-en-klare gast is meteen geldig (kracht uit de lijst)', () => {
    const g = newGame();
    const guest = addGuest(g, GUESTS[0]);
    expect(guest.name).toBe(GUESTS[0].name);
    expect(guest.player).toBe('Gast');
  });

  it('afwezige helden trekken het groepsniveau niet naar beneden', () => {
    const { g, a, b } = playedSession();
    a.level = 3;
    b.level = 1;
    b.present = false;
    expect(addHero(g, draft('C')).pendingLevelUps).toBe(2);
  });

  it('groepsniveau = gemiddelde, naar beneden afgerond', () => {
    expect(groupLevel([1, 2, 4])).toBe(2);
    expect(groupLevel([])).toBe(1);
  });

  it('de slechterik schaalt mee: extra leven vanaf gemiddeld niveau 4', () => {
    expect(finaleHearts(0, 0, 3, 3)).toBe(2);
    expect(finaleHearts(0, 0, 3, 4)).toBe(3);
  });
});

describe('titels', () => {
  it('3× in een kip veranderd = Kiekenkoning(in), met melding', () => {
    const g = newGame();
    const a = addHero(g, draft('Anna'));
    takeTitleNews();
    for (let i = 0; i < 3; i++) setPech(g, a.id, 'Ge zijt een kip. Ge moogt alleen nog “tok” zeggen.');
    expect(a.titles).toContain('kiek');
    expect(takeTitleNews()).toEqual(['Anna: Kiekenkoning(in)!']);
    expect(takeTitleNews()).toEqual([]);
  });

  it('frietjes eten telt mee', () => {
    const g = newGame();
    const a = addHero(g, draft('A'));
    for (let i = 0; i < 10; i++) {
      a.fries = 1;
      eatFry(g, a.id);
    }
    expect(a.titles).toContain('frietvreter');
  });
});
