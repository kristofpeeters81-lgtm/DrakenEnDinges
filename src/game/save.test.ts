import { describe, expect, it } from 'vitest';
import { POWERS } from '../data/ideas';
import { APP_ID, parseGame, saveFileName, SaveError, serializeGame, SAVE_VERSION } from './save';
import { addHero, emptyDraft, newGame, startSession } from './state';

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

  it('bestandsnaam met datum, als .txt (deelbaar via Android)', () => {
    expect(saveFileName(new Date(2026, 10, 14, 20, 5))).toBe('Draken en Dinges - 2026-11-14 20.05.txt');
  });
});
