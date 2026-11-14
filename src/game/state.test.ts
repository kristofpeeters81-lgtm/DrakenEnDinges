import { describe, expect, it } from 'vitest';
import { POWERS } from '../data/ideas';
import {
  addFry,
  addHero,
  canRoll,
  giveItem,
  MAX_ITEMS,
  nextScene,
  setPech,
  takeReward,
  useItem,
  beginSeasonSession,
  recordFinaleRound,
  recordMoment,
  seasonInProgress,
  chooseOpening,
  currentHero,
  eatFry,
  emptyDraft,
  hasUnsavedChanges,
  markFileSaved,
  markRolled,
  MAX_FRIES,
  MAX_HEROES,
  newGame,
  nextTurn,
  removeHero,
  setPresent,
  startSession,
  updateHero,
  validateDraft,
  type HeroDraft,
} from './state';

function draft(name: string, power: string = POWERS[0]): HeroDraft {
  return { ...emptyDraft(), name, player: 'Papa', kind: 'Trol die koekjes bakt', goodAt: ['Klimmen', 'Koken'], badAt: 'Tellen', power };
}

describe('aanmaken van helden', () => {
  it('een volledige held is geldig', () => {
    expect(validateDraft(draft('Gerard'))).toEqual([]);
  });

  it('meldt wat er ontbreekt', () => {
    const errors = validateDraft(emptyDraft());
    expect(errors).toContain('Geef uw held een naam.');
    expect(errors.length).toBeGreaterThanOrEqual(5);
  });

  it('2× hetzelfde "goed in" mag niet', () => {
    expect(validateDraft({ ...draft('X'), goodAt: ['Klimmen', 'klimmen '] })).toContain('Kies 2 verschillende dingen bij "goed in".');
  });

  it('een zelfverzonnen kracht moet goedgekeurd worden, een kracht uit de lijst niet', () => {
    expect(validateDraft(draft('X', 'Onoverwinnelijk'))).toContain('Iedereen aan tafel moet "ja" zeggen tegen een zelfverzonnen kracht.');
    expect(validateDraft({ ...draft('X', 'Spaghetti uit mijn oren schieten'), powerApproved: true })).toEqual([]);
    expect(validateDraft(draft('X', POWERS[3].toUpperCase()))).toEqual([]);
  });

  it('maximum 6 helden', () => {
    const g = newGame();
    for (let i = 0; i < MAX_HEROES; i++) addHero(g, draft(`H${i}`));
    expect(() => addHero(g, draft('Te veel'))).toThrow();
  });

  it('aanpassen houdt frietjes en aanwezigheid', () => {
    const g = newGame();
    const h = addHero(g, draft('Gerard'));
    h.fries = 1;
    updateHero(g, h.id, draft('Gerard de Grote'));
    expect(g.heroes[0].name).toBe('Gerard de Grote');
    expect(g.heroes[0].fries).toBe(1);
    expect(g.heroes[0].present).toBe(true);
  });
});

describe('sessies en beurten', () => {
  function threeHeroes() {
    const g = newGame();
    const a = addHero(g, draft('A'));
    const b = addHero(g, draft('B'));
    const c = addHero(g, draft('C'));
    return { g, a, b, c };
  }

  it('start sessie: iedereen 3 frietjes, kracht weer beschikbaar, eerste aan de beurt', () => {
    const { g, a } = threeHeroes();
    a.fries = 0;
    a.powerUsedCount = 1;
    startSession(g);
    expect(g.session).toBe(1);
    expect(g.sessionActive).toBe(true);
    expect(a.fries).toBe(3);
    expect(a.powerUsedCount).toBe(0);
    expect(currentHero(g)?.name).toBe('A');
  });

  it('kan niet starten zonder meespelers', () => {
    const { g, a, b, c } = threeHeroes();
    for (const h of [a, b, c]) setPresent(g, h.id, false);
    expect(() => startSession(g)).toThrow();
  });

  it('volgende beurt draait rond en slaat afwezigen over', () => {
    const { g, b } = threeHeroes();
    startSession(g);
    setPresent(g, b.id, false);
    expect(currentHero(g)?.name).toBe('A');
    nextTurn(g);
    expect(currentHero(g)?.name).toBe('C');
    nextTurn(g);
    expect(currentHero(g)?.name).toBe('A');
  });

  it('de beurt blijft bij dezelfde held als iemand in- of uitstapt', () => {
    const { g, a, c } = threeHeroes();
    startSession(g);
    nextTurn(g);
    nextTurn(g); // C aan de beurt
    setPresent(g, a.id, false);
    expect(currentHero(g)?.id).toBe(c.id);
    setPresent(g, a.id, true);
    expect(currentHero(g)?.id).toBe(c.id);
  });

  it('wie aan de beurt is en verdwijnt, geeft de beurt door', () => {
    const { g, a } = threeHeroes();
    startSession(g);
    removeHero(g, a.id);
    expect(currentHero(g)?.name).toBe('B');
  });

  it('gast die instapt tijdens een sessie krijgt volle frietjes en een ongebruikte kracht', () => {
    const { g, b } = threeHeroes();
    startSession(g);
    setPresent(g, b.id, false);
    b.fries = 0;
    b.powerUsedCount = 1;
    setPresent(g, b.id, true);
    expect(b.fries).toBe(3);
    expect(b.powerUsedCount).toBe(0);
  });
});

describe('één worp per beurt', () => {
  function session() {
    const g = newGame();
    const a = addHero(g, draft('A'));
    const b = addHero(g, draft('B'));
    startSession(g);
    return { g, a, b };
  }

  it('na een worp kan dezelfde held niet opnieuw rollen', () => {
    const { g, a } = session();
    expect(canRoll(g, a.id)).toBe(true);
    markRolled(g, a.id);
    expect(canRoll(g, a.id)).toBe(false);
  });

  it('het slot gaat pas open als de held weer zelf aan de beurt is', () => {
    const { g, a, b } = session();
    markRolled(g, a.id);
    nextTurn(g); // B aan de beurt
    expect(canRoll(g, a.id)).toBe(false);
    expect(canRoll(g, b.id)).toBe(true);
    nextTurn(g); // A weer aan de beurt
    expect(canRoll(g, a.id)).toBe(true);
  });

  it('uitzonderlijke worp van iemand die niet aan de beurt is: slot tot zijn eigen beurt', () => {
    const { g, b } = session();
    markRolled(g, b.id); // A is aan de beurt, B rolt uitzonderlijk
    expect(canRoll(g, b.id)).toBe(false);
    nextTurn(g); // B's eigen beurt
    expect(canRoll(g, b.id)).toBe(true);
  });

  it('alleen spelen: na "volgende" mag de enige held weer rollen', () => {
    const g = newGame();
    const a = addHero(g, draft('Solo'));
    startSession(g);
    markRolled(g, a.id);
    nextTurn(g);
    expect(canRoll(g, a.id)).toBe(true);
  });

  it('nieuwe sessie of instappen: slot open', () => {
    const { g, a, b } = session();
    markRolled(g, a.id);
    markRolled(g, b.id);
    setPresent(g, b.id, false);
    setPresent(g, b.id, true);
    expect(canRoll(g, b.id)).toBe(true);
    startSession(g);
    expect(canRoll(g, a.id)).toBe(true);
  });

  it('afwezig of buiten een sessie: niet rollen', () => {
    const { g, a, b } = session();
    setPresent(g, b.id, false);
    expect(canRoll(g, b.id)).toBe(false);
    g.sessionActive = false;
    expect(canRoll(g, a.id)).toBe(false);
  });
});

describe('seizoen in het spel', () => {
  const counts = { villains: 3, places: 6, figures: 4 };

  function playing(n: number) {
    const g = newGame();
    for (let i = 0; i < n; i++) addHero(g, draft(`H${i}`));
    startSession(g);
    return g;
  }

  it('een heel seizoen: 3 hoofdstukken, dan finale tot de slechterik verslagen is', () => {
    const g = playing(3);
    beginSeasonSession(g, counts);
    expect(g.sessionMode).toBe('seizoen');
    expect(g.usedVillains).toEqual([g.season?.villain]);
    for (let ch = 0; ch < 3; ch++) {
      expect(g.season?.chapter).toBe(ch);
      recordMoment(g, 0); // telkens mislukt → meter 6
      startSession(g);
      beginSeasonSession(g, counts);
    }
    expect(g.season?.chapter).toBe(3);
    expect(g.season?.meter).toBe(6);
    expect(g.season?.hearts).toBe(5);
    let rounds = 0;
    while (!recordFinaleRound(g, 1)) rounds++;
    expect(rounds).toBe(4);
    expect(seasonInProgress(g)).toBe(false);
  });

  it('sessie gestopt vóór het beslissende moment: volgende keer hetzelfde hoofdstuk', () => {
    const g = playing(2);
    beginSeasonSession(g, counts);
    startSession(g);
    beginSeasonSession(g, counts);
    expect(g.season?.chapter).toBe(0);
  });

  it('na een afgelopen seizoen komt er een nieuwe slechterik', () => {
    const g = playing(2);
    beginSeasonSession(g, counts);
    const first = g.season?.villain;
    if (g.season) g.season.finished = true;
    beginSeasonSession(g, counts);
    expect(g.season?.villain).not.toBe(first);
    expect(g.usedVillains.length).toBe(2);
  });

  it('met 1 held telt de bondgenoot mee bij het beslissende moment', () => {
    const g = playing(1);
    beginSeasonSession(g, counts);
    expect(recordMoment(g, 2)).toBe('perfect');
  });
});

describe('rugzak, pech en beloning', () => {
  const counts = { villains: 3, places: 6, figures: 4 };

  it('voorwerpen: max. 6 per held, en nooit twee keer hetzelfde in de groep', () => {
    const g = newGame();
    const a = addHero(g, draft('A'));
    const b = addHero(g, draft('B'));
    expect(giveItem(g, a.id, 3)).toBe(true);
    expect(giveItem(g, b.id, 3)).toBe(false);
    for (let i = 10; i < 10 + MAX_ITEMS - 1; i++) giveItem(g, a.id, i);
    expect(a.items.length).toBe(MAX_ITEMS);
    expect(giveItem(g, a.id, 99)).toBe(false);
  });

  it('een voorwerp kan 1× per sessie gebruikt worden', () => {
    const g = newGame();
    const a = addHero(g, draft('A'));
    giveItem(g, a.id, 1);
    startSession(g);
    expect(useItem(g, a.id, 0)).toBe(true);
    expect(useItem(g, a.id, 0)).toBe(false);
    startSession(g);
    expect(useItem(g, a.id, 0)).toBe(true);
  });

  it('zotte pech verdwijnt bij de volgende scène en bij een nieuwe sessie', () => {
    const g = newGame();
    const a = addHero(g, draft('A'));
    startSession(g);
    beginSeasonSession(g, counts);
    setPech(g, a.id, 'paars haar');
    nextScene(g);
    expect(a.pech).toBeNull();
    setPech(g, a.id, 'kip');
    startSession(g);
    expect(a.pech).toBeNull();
  });

  it('beloning: enkel na een gelukt beslissend moment, en maar één keer', () => {
    const g = newGame();
    addHero(g, draft('A'));
    addHero(g, draft('B'));
    addHero(g, draft('C'));
    startSession(g);
    beginSeasonSession(g, counts);
    expect(takeReward(g)).toBe(false);
    recordMoment(g, 3);
    expect(takeReward(g)).toBe(true);
    expect(takeReward(g)).toBe(false);
  });

  it('geen beloning na een mislukt moment', () => {
    const g = newGame();
    addHero(g, draft('A'));
    addHero(g, draft('B'));
    addHero(g, draft('C'));
    startSession(g);
    beginSeasonSession(g, counts);
    recordMoment(g, 0);
    expect(takeReward(g)).toBe(false);
  });
});

describe('beginscènes', () => {
  it('kiest pas opnieuw dezelfde als alles geweest is', () => {
    const g = newGame();
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      chooseOpening(g, 5);
      seen.push(g.opening ?? -1);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
    chooseOpening(g, 5);
    expect(g.opening).not.toBe(seen[4]);
  });

  it('"andere beginscène" geeft nooit dezelfde', () => {
    const g = newGame();
    for (let i = 0; i < 50; i++) {
      const before = g.opening;
      chooseOpening(g, 3);
      expect(g.opening).not.toBe(before);
    }
  });

  it('zonder beginscènes: geen', () => {
    const g = newGame();
    chooseOpening(g, 0);
    expect(g.opening).toBeNull();
  });
});

describe('frietjes', () => {
  it('opeten tot op, en dan niet meer', () => {
    const g = newGame();
    const h = addHero(g, draft('A'));
    expect(eatFry(g, h.id)).toBe(true);
    expect(eatFry(g, h.id)).toBe(true);
    expect(eatFry(g, h.id)).toBe(true);
    expect(eatFry(g, h.id)).toBe(false);
    expect(h.fries).toBe(0);
  });

  it('bijverdienen tot het maximum', () => {
    const g = newGame();
    const h = addHero(g, draft('A'));
    while (addFry(g, h.id));
    expect(h.fries).toBe(MAX_FRIES);
  });
});

describe('bewaar-herinnering', () => {
  it('na een wijziging is er iets te bewaren, na bewaren niet meer', () => {
    const g = newGame();
    expect(hasUnsavedChanges(g)).toBe(false);
    const h = addHero(g, draft('A'));
    expect(hasUnsavedChanges(g)).toBe(true);
    markFileSaved(g);
    expect(hasUnsavedChanges(g)).toBe(false);
    eatFry(g, h.id);
    expect(hasUnsavedChanges(g)).toBe(true);
  });
});
