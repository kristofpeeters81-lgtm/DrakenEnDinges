import { describe, expect, it } from 'vitest';
import { POWERS } from '../data/ideas';
import { APP_ID, parseGame, saveFileName, SaveError, serializeGame, SAVE_VERSION } from './save';
import { addHero, beginLooseSession, beginSeasonSession, emptyDraft, newGame, recordMoment, startSession } from './state';

function sampleGame() {
  const g = newGame(1000);
  addHero(g, { ...emptyDraft(), name: 'Gerard', player: 'Papa', kind: 'Trol', goodAt: ['Klimmen', 'Koken'], badAt: 'Tellen', power: POWERS[1] });
  addHero(g, { ...emptyDraft(), name: 'Mie', player: 'Mama', kind: 'Heks', goodAt: ['Toveren', 'Ruiken'], badAt: 'Wachten', power: 'Spaghetti-ogen', powerApproved: true });
  startSession(g);
  return g;
}

describe('spelbestand', () => {
  it('bewaren en terug laden geeft exact hetzelfde spel', () => {
    const g = sampleGame();
    expect(parseGame(serializeGame(g))).toEqual(g);
  });

  it('bevat app-naam en versienummer', () => {
    const raw: unknown = JSON.parse(serializeGame(sampleGame()));
    expect(raw).toMatchObject({ app: APP_ID, version: SAVE_VERSION });
  });

  it('weigert een willekeurig bestand met een duidelijke boodschap', () => {
    expect(() => parseGame('hallo')).toThrow(SaveError);
    expect(() => parseGame('{"app":"iets-anders","version":1}')).toThrow('Dit is geen spelbestand van Draken & Dinges.');
  });

  it('weigert een bestand van een nieuwere app-versie', () => {
    const text = JSON.stringify({ app: APP_ID, version: SAVE_VERSION + 1, game: {} });
    expect(() => parseGame(text)).toThrow(/nieuwere versie/);
  });

  it('weigert een beschadigd bestand', () => {
    const raw = JSON.parse(serializeGame(sampleGame())) as { game: { heroes: Array<Record<string, unknown>> } };
    raw.game.heroes[0].goodAt = 'klimmen';
    expect(() => parseGame(JSON.stringify(raw))).toThrow('Het spelbestand is beschadigd.');
  });

  it('begrenst rare getallen in plaats van ze blind over te nemen', () => {
    const raw = JSON.parse(serializeGame(sampleGame())) as { game: { heroes: Array<Record<string, unknown>> } };
    raw.game.heroes[0].fries = 9999;
    expect(parseGame(JSON.stringify(raw)).heroes[0].fries).toBe(8);
  });

  it('een oud bestand (versie 1, zonder rolslot) laadt nog altijd', () => {
    const g = sampleGame();
    const raw = JSON.parse(serializeGame(g)) as { version: number; game: { heroes: Array<Record<string, unknown>> } };
    raw.version = 1;
    for (const h of raw.game.heroes) delete h.rolled;
    const loaded = parseGame(JSON.stringify(raw));
    expect(loaded.heroes.map((h) => h.rolled)).toEqual([false, false]);
    expect(loaded.heroes.map((h) => h.name)).toEqual(['Gerard', 'Mie']);
  });

  it('een bestand van versie 2 krijgt lege beginscène-gegevens', () => {
    const raw = JSON.parse(serializeGame(sampleGame())) as { version: number; game: Record<string, unknown> };
    raw.version = 2;
    delete raw.game.opening;
    delete raw.game.usedOpenings;
    const loaded = parseGame(JSON.stringify(raw));
    expect(loaded.opening).toBeNull();
    expect(loaded.usedOpenings).toEqual([]);
  });

  it('bewaart welke beginscène nu speelt en welke al geweest zijn', () => {
    const g = sampleGame();
    g.opening = 4;
    g.usedOpenings = [2, 4];
    const loaded = parseGame(serializeGame(g));
    expect(loaded.opening).toBe(4);
    expect(loaded.usedOpenings).toEqual([2, 4]);
  });

  it('een bestand van versie 3 krijgt lege seizoensgegevens', () => {
    const raw = JSON.parse(serializeGame(sampleGame())) as { version: number; game: Record<string, unknown> };
    raw.version = 3;
    delete raw.game.season;
    delete raw.game.usedVillains;
    delete raw.game.sessionMode;
    const loaded = parseGame(JSON.stringify(raw));
    expect(loaded.season).toBeNull();
    expect(loaded.usedVillains).toEqual([]);
    expect(loaded.sessionMode).toBe('los');
  });

  it('bewaart een lopend seizoen volledig', () => {
    const g = sampleGame();
    beginSeasonSession(g, { villains: 3, places: 6, figures: 4 });
    recordMoment(g, 1);
    const loaded = parseGame(serializeGame(g));
    expect(loaded.season).toEqual(g.season);
    expect(loaded.usedVillains).toEqual(g.usedVillains);
    expect(loaded.sessionMode).toBe('seizoen');
  });

  it('een seizoen uit versie 4 krijgt de juiste scène', () => {
    const g = sampleGame();
    beginSeasonSession(g, { villains: 3, places: 6, figures: 4 });
    const raw = JSON.parse(serializeGame(g)) as { version: number; game: { season: Record<string, unknown> } };
    raw.version = 4;
    delete raw.game.season.scene;
    expect(parseGame(JSON.stringify(raw)).season?.scene).toBe(0);
    raw.game.season.momentDone = true;
    expect(parseGame(JSON.stringify(raw)).season?.scene).toBe(2);
  });

  it('een bestand van versie 5 krijgt lege rugzakken en geen pech', () => {
    const raw = JSON.parse(serializeGame(sampleGame())) as { version: number; game: { heroes: Array<Record<string, unknown>> } };
    raw.version = 5;
    for (const h of raw.game.heroes) {
      delete h.pech;
      delete h.items;
    }
    const loaded = parseGame(JSON.stringify(raw));
    expect(loaded.heroes.map((h) => h.items)).toEqual([[], []]);
    expect(loaded.heroes.map((h) => h.pech)).toEqual([null, null]);
  });

  it('bewaart rugzak en pech', () => {
    const g = sampleGame();
    g.heroes[0].items = [{ item: 4, level: 2, usedCount: 1 }];
    g.heroes[1].pech = 'kip';
    const loaded = parseGame(serializeGame(g));
    expect(loaded.heroes[0].items).toEqual([{ item: 4, level: 2, usedCount: 1 }]);
    expect(loaded.heroes[1].pech).toBe('kip');
  });

  it('een bestand van versie 6 krijgt groeigegevens (niveau 1) en tellers voor kracht en voorwerpen', () => {
    const raw = JSON.parse(serializeGame(sampleGame())) as { version: number; game: { heroes: Array<Record<string, unknown>> } };
    raw.version = 6;
    for (const h of raw.game.heroes) {
      for (const k of ['powerUsedCount', 'level', 'pendingLevelUps', 'extraGood', 'powerMax', 'bonusFries', 'buddy', 'stats', 'titles']) delete h[k];
      h.powerUsed = true;
      h.items = [{ item: 2, used: true }];
    }
    const loaded = parseGame(JSON.stringify(raw));
    expect(loaded.heroes[0].level).toBe(1);
    expect(loaded.heroes[0].powerUsedCount).toBe(1);
    expect(loaded.heroes[0].items).toEqual([{ item: 2, level: 1, usedCount: 1 }]);
    expect(loaded.heroes[0].buddy).toBeNull();
  });

  it('een seizoen uit versie 7 krijgt sleutelmomenten voor de scènes die al voorbij zijn', () => {
    const g = sampleGame();
    beginSeasonSession(g, { villains: 3, places: 6, figures: 4 });
    const raw = JSON.parse(serializeGame(g)) as { version: number; game: { season: Record<string, unknown> } };
    raw.version = 7;
    delete raw.game.season.keys;
    raw.game.season.leadRolls = 2;
    raw.game.season.goalMet = true;
    raw.game.season.scene = 1;
    const loaded = parseGame(JSON.stringify(raw));
    expect(loaded.season?.keys).toEqual([true]);
    expect(loaded.season && 'leadRolls' in loaded.season).toBe(false);
  });

  it('bewaart het verhaallogboek van een hoofdstuk', () => {
    const g = sampleGame();
    beginSeasonSession(g, { villains: 3, places: 6, figures: 4 });
    if (g.season) g.season.log = [{ scene: 0, hero: 'Gerard', action: -1, text: 'We bakken een taart', success: true }];
    expect(parseGame(serializeGame(g)).season?.log).toEqual(g.season?.log);
  });

  it('een seizoen uit versie 8 krijgt een leeg logboek', () => {
    const g = sampleGame();
    beginSeasonSession(g, { villains: 3, places: 6, figures: 4 });
    const raw = JSON.parse(serializeGame(g)) as { version: number; game: { season: Record<string, unknown> } };
    raw.version = 8;
    delete raw.game.season.log;
    expect(parseGame(JSON.stringify(raw)).season?.log).toEqual([]);
  });

  it('bewaart een los avontuur volledig en vult bij versie 9 een leeg avontuur aan', () => {
    const g = sampleGame();
    beginLooseSession(g, 15);
    if (g.adventure) g.adventure.log = [{ scene: 0, hero: 'Mie', action: 2, text: '', success: false }];
    expect(parseGame(serializeGame(g)).adventure).toEqual(g.adventure);
    const raw = JSON.parse(serializeGame(g)) as { version: number; game: Record<string, unknown> };
    raw.version = 9;
    delete raw.game.adventure;
    delete raw.game.usedAdventures;
    const old = parseGame(JSON.stringify(raw));
    expect(old.adventure).toBeNull();
    expect(old.usedAdventures).toEqual([]);
  });

  it('bestandsnaam met datum, als .txt (deelbaar via Android)', () => {
    expect(saveFileName(new Date(2026, 10, 14, 20, 5))).toBe('Draken en Dinges - 2026-11-14 20.05.txt');
  });
});
