// Spelbestand: de volledige spelstand als tekst (JSON) met een versienummer.
// Wordt gebruikt voor het bestand (bewaren/laden) én voor de automatische reservekopie in de browser.
// Oude bestanden moeten na app-updates blijven werken: verhoog SAVE_VERSION en voeg een stap toe in migrate().

import { CHAPTERS, MAX_LEAD_FROM_ROLLS, METER_MAX, MOMENT_SCENE, type ChapterResult, type Season } from './season';
import { MAX_FRIES, MAX_HEROES, type Game, type Hero, type SessionMode } from './state';

export const APP_ID = 'draken-en-dinges';
export const SAVE_VERSION = 5;

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
  return g;
}

/** Versie 2: helden kregen een "rolled"-slot (één worp per beurt). Oude spellen: nog niemand heeft gerold. */
/** Versie 3: beginscènes (welke nu, welke al geweest). Oude spellen: nog geen. */
/** Versie 4: seizoenen. Oude spellen: nog geen seizoen; een lopende sessie was een los avontuur. */
/** Versie 5: scènes in een hoofdstuk. Oud seizoen: begin van het hoofdstuk, of het moment als dat al gespeeld is. */
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
    powerUsed: bool(v, 'powerUsed'),
    rolled: bool(v, 'rolled'),
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
    leadRolls: num(v, 'leadRolls', 0, MAX_LEAD_FROM_ROLLS),
    goalMet: bool(v, 'goalMet'),
    hearts: readNullableCount(v.hearts),
    heartsStart: readNullableCount(v.heartsStart),
    finished: bool(v, 'finished'),
  };
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
