// Spelbestand: de volledige spelstand als tekst (JSON) met een versienummer.
// Wordt gebruikt voor het bestand (bewaren/laden) én voor de automatische reservekopie in de browser.
// Oude bestanden moeten na app-updates blijven werken: verhoog SAVE_VERSION en voeg een stap toe in migrate().

import { CHAPTERS, KEY_MOMENTS, METER_MAX, MOMENT_SCENE, OWN_IDEA, type ChapterResult, type LogEntry, type Season } from './season';
import { emptyStats, type HeroStats } from '../data/growth-data';
import { MAX_BONUS_FRIES, MAX_BUDDY_STAGE, MAX_EXTRA_GOOD, MAX_ITEM_LEVEL, MAX_LEVEL, MAX_POWER_USES, type Buddy } from './growth';
import { MAX_FRIES, MAX_HEROES, MAX_ITEMS, type Game, type Hero, type HeroItem, type SessionMode } from './state';

export const APP_ID = 'draken-en-dinges';
export const SAVE_VERSION = 9;

export class SaveError extends Error {}

export function serializeGame(game: Game, now: number = Date.now()): string {
  return JSON.stringify({ app: APP_ID, version: SAVE_VERSION, savedAt: now, game }, null, 1);
}

/** Bestandsnaam zoals "Draken en Dinges - 2026-11-14 20.15.txt".
 *  Bewust .txt: het deelmenu van Android (Drive, WhatsApp…) aanvaardt geen .json-bestanden. */
export function saveFileName(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `Draken en Dinges - ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}.${pad(date.getMinutes())}.txt`;
}

export function parseGame(text: string): Game {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SaveError('Dit is geen spelbestand van Draken & Dinges.');
  }
  if (!isRecord(raw) || raw.app !== APP_ID) throw new SaveError('Dit is geen spelbestand van Draken & Dinges.');
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new SaveError('Het spelbestand is beschadigd.');
  if (version > SAVE_VERSION) throw new SaveError('Dit spelbestand is gemaakt met een nieuwere versie van de app. Ververs de app en probeer opnieuw.');
  return readGame(migrate(raw.game, version));
}

/** Zet een oud spel stap voor stap om naar het huidige formaat. */
function migrate(game: unknown, fromVersion: number): unknown {
  let g = game;
  if (fromVersion < 2) g = v1ToV2(g);
  if (fromVersion < 3) g = v2ToV3(g);
  if (fromVersion < 4) g = v3ToV4(g);
  if (fromVersion < 5) g = v4ToV5(g);
  if (fromVersion < 6) g = v5ToV6(g);
  if (fromVersion < 7) g = v6ToV7(g);
  if (fromVersion < 8) g = v7ToV8(g);
  if (fromVersion < 9) g = v8ToV9(g);
  return g;
}

/** Versie 2: helden kregen een "rolled"-slot (één worp per beurt). Oude spellen: nog niemand heeft gerold. */
/** Versie 3: beginscènes (welke nu, welke al geweest). Oude spellen: nog geen. */
/** Versie 4: seizoenen. Oude spellen: nog geen seizoen; een lopende sessie was een los avontuur. */
/** Versie 5: scènes in een hoofdstuk. Oud seizoen: begin van het hoofdstuk, of het moment als dat al gespeeld is. */
/** Versie 6: zotte pech, rugzak en beloning. Oude helden: geen pech, lege rugzak; beloning telt als gegeven. */
/** Versie 7: groei. Oude helden: niveau 1, geen extra's; kracht/voorwerpen als tellers. */
/** Versie 8: sleutelmomenten met vertakkingen i.p.v. sterren uit vrije worpen. Een lopend hoofdstuk krijgt
 *  "gelukte" sleutels voor de scènes die al voorbij zijn (zo verliest niemand voorsprong). */
/** Versie 9: scènes met acties en een verhaallogboek. Oud seizoen: leeg logboek. */
function v8ToV9(game: unknown): unknown {
  if (!isRecord(game) || !isRecord(game.season)) return game;
  return { ...game, season: { ...game.season, log: [] } };
}

function v7ToV8(game: unknown): unknown {
  if (!isRecord(game) || !isRecord(game.season)) return game;
  const { leadRolls: _l, goalMet: _g, ...season } = game.season;
  const scene = typeof season.scene === 'number' ? season.scene : 0;
  return { ...game, season: { ...season, keys: Array.from({ length: Math.min(scene, KEY_MOMENTS) }, () => true) } };
}

function v6ToV7(game: unknown): unknown {
  if (!isRecord(game) || !Array.isArray(game.heroes)) return game;
  const heroes = game.heroes.map((h: unknown) => {
    if (!isRecord(h)) return h;
    const items = Array.isArray(h.items)
      ? h.items.map((it: unknown) => (isRecord(it) ? { item: it.item, level: 1, usedCount: it.used === true ? 1 : 0 } : it))
      : h.items;
    return {
      ...h,
      items,
      powerUsedCount: h.powerUsed === true ? 1 : 0,
      level: 1,
      pendingLevelUps: 0,
      extraGood: [],
      powerMax: 1,
      bonusFries: 0,
      buddy: null,
      stats: emptyStats(),
      titles: [],
    };
  });
  return { ...game, heroes };
}

function v5ToV6(game: unknown): unknown {
  if (!isRecord(game) || !Array.isArray(game.heroes)) return game;
  const heroes = game.heroes.map((h: unknown) => (isRecord(h) ? { ...h, pech: null, items: [] } : h));
  const season = isRecord(game.season) ? { ...game.season, rewardTaken: true } : game.season;
  return { ...game, heroes, season };
}

function v4ToV5(game: unknown): unknown {
  if (!isRecord(game) || !isRecord(game.season)) return game;
  return { ...game, season: { ...game.season, scene: game.season.momentDone === true ? MOMENT_SCENE : 0 } };
}

function v3ToV4(game: unknown): unknown {
  if (!isRecord(game)) return game;
  return { ...game, season: null, usedVillains: [], sessionMode: game.sessionActive === true ? 'los' : null };
}

function v2ToV3(game: unknown): unknown {
  if (!isRecord(game)) return game;
  return { ...game, opening: null, usedOpenings: [] };
}

function v1ToV2(game: unknown): unknown {
  if (!isRecord(game) || !Array.isArray(game.heroes)) return game;
  return { ...game, heroes: game.heroes.map((h: unknown) => (isRecord(h) ? { ...h, rolled: false } : h)) };
}

// ---------- uitlezen met controle (nooit blind vertrouwen op een bestand) ----------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function broken(): never {
  throw new SaveError('Het spelbestand is beschadigd.');
}

function str(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  return typeof v === 'string' ? v.slice(0, 200) : broken();
}

function num(o: Record<string, unknown>, key: string, min: number, max: number): number {
  const v = o[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) broken();
  return Math.min(max, Math.max(min, Math.round(v)));
}

function bool(o: Record<string, unknown>, key: string): boolean {
  const v = o[key];
  return typeof v === 'boolean' ? v : broken();
}

function readStrings(v: unknown, max: number): string[] {
  if (!Array.isArray(v) || v.length > max) broken();
  return v.map((s: unknown) => (typeof s === 'string' ? s.slice(0, 200) : broken()));
}

function readBuddy(v: unknown): Buddy | null {
  if (v === null) return null;
  if (!isRecord(v)) broken();
  return { kind: num(v, 'kind', 0, 999), name: str(v, 'name'), stage: num(v, 'stage', 1, MAX_BUDDY_STAGE), usedCount: num(v, 'usedCount', 0, MAX_BUDDY_STAGE) };
}

function readStats(v: unknown): HeroStats {
  if (!isRecord(v)) broken();
  const s = emptyStats();
  for (const k of Object.keys(s) as Array<keyof HeroStats>) s[k] = num(v, k, 0, 1_000_000);
  return s;
}

function readItems(v: unknown): HeroItem[] {
  if (!Array.isArray(v) || v.length > MAX_ITEMS) broken();
  return v.map((it: unknown) => {
    if (!isRecord(it)) broken();
    return { item: num(it, 'item', 0, 9999), level: num(it, 'level', 1, MAX_ITEM_LEVEL), usedCount: num(it, 'usedCount', 0, MAX_ITEM_LEVEL) };
  });
}

function readHero(v: unknown): Hero {
  if (!isRecord(v)) broken();
  const goodAt = v.goodAt;
  if (!Array.isArray(goodAt) || goodAt.length !== 2 || typeof goodAt[0] !== 'string' || typeof goodAt[1] !== 'string') broken();
  return {
    id: str(v, 'id'),
    name: str(v, 'name'),
    player: str(v, 'player'),
    kind: str(v, 'kind'),
    goodAt: [goodAt[0].slice(0, 200), goodAt[1].slice(0, 200)],
    badAt: str(v, 'badAt'),
    power: str(v, 'power'),
    powerApproved: bool(v, 'powerApproved'),
    present: bool(v, 'present'),
    fries: num(v, 'fries', 0, MAX_FRIES),
    powerUsedCount: num(v, 'powerUsedCount', 0, MAX_POWER_USES),
    rolled: bool(v, 'rolled'),
    pech: v.pech === null ? null : str(v, 'pech'),
    items: readItems(v.items),
    level: num(v, 'level', 1, MAX_LEVEL),
    pendingLevelUps: num(v, 'pendingLevelUps', 0, MAX_LEVEL),
    extraGood: readStrings(v.extraGood, MAX_EXTRA_GOOD),
    powerMax: num(v, 'powerMax', 1, MAX_POWER_USES),
    bonusFries: num(v, 'bonusFries', 0, MAX_BONUS_FRIES),
    buddy: readBuddy(v.buddy),
    stats: readStats(v.stats),
    titles: readStrings(v.titles, 50),
  };
}

function readOpening(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 9999) broken();
  return v;
}

function readUsed(v: unknown): number[] {
  if (!Array.isArray(v) || v.length > 10000) broken();
  return v.map((n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : broken()));
}

function readMode(v: unknown): SessionMode | null {
  if (v === null || v === 'seizoen' || v === 'los') return v;
  return broken();
}

function readNullableCount(v: unknown): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 100) broken();
  return v;
}

const RESULTS: readonly ChapterResult[] = ['perfect', 'gehaald', 'mislukt'];

function readSeason(v: unknown): Season | null {
  if (v === null) return null;
  if (!isRecord(v) || !Array.isArray(v.results)) broken();
  const results = v.results.map((r: unknown) => (RESULTS.includes(r as ChapterResult) ? (r as ChapterResult) : broken()));
  return {
    villain: num(v, 'villain', 0, 9999),
    places: readUsed(v.places),
    figures: readUsed(v.figures),
    chapter: num(v, 'chapter', 0, CHAPTERS),
    meter: num(v, 'meter', 0, METER_MAX),
    clues: num(v, 'clues', 0, CHAPTERS),
    results,
    momentDone: bool(v, 'momentDone'),
    scene: num(v, 'scene', 0, MOMENT_SCENE),
    rewardTaken: bool(v, 'rewardTaken'),
    keys: readKeys(v.keys),
    log: readLog(v.log),
    hearts: readNullableCount(v.hearts),
    heartsStart: readNullableCount(v.heartsStart),
    finished: bool(v, 'finished'),
  };
}

function readLog(v: unknown): LogEntry[] {
  if (!Array.isArray(v) || v.length > 100) broken();
  return v.map((e: unknown) => {
    if (!isRecord(e)) broken();
    return { scene: num(e, 'scene', 0, MOMENT_SCENE), hero: str(e, 'hero'), action: num(e, 'action', OWN_IDEA, 99), text: str(e, 'text'), success: bool(e, 'success') };
  });
}

function readKeys(v: unknown): boolean[] {
  if (!Array.isArray(v) || v.length > KEY_MOMENTS) broken();
  return v.map((b: unknown) => (typeof b === 'boolean' ? b : broken()));
}

function readGame(v: unknown): Game {
  if (!isRecord(v) || !Array.isArray(v.heroes)) broken();
  const heroes = v.heroes.map(readHero);
  if (heroes.length > MAX_HEROES) broken();
  const last = v.lastFileSave;
  if (last !== null && (typeof last !== 'number' || !Number.isFinite(last))) broken();
  return {
    id: str(v, 'id'),
    createdAt: num(v, 'createdAt', 0, Number.MAX_SAFE_INTEGER),
    updatedAt: num(v, 'updatedAt', 0, Number.MAX_SAFE_INTEGER),
    session: num(v, 'session', 0, 100000),
    sessionActive: bool(v, 'sessionActive'),
    turn: num(v, 'turn', 0, MAX_HEROES),
    heroes,
    lastFileSave: last,
    opening: readOpening(v.opening),
    usedOpenings: readUsed(v.usedOpenings),
    season: readSeason(v.season),
    usedVillains: readUsed(v.usedVillains),
    sessionMode: readMode(v.sessionMode),
  };
}
