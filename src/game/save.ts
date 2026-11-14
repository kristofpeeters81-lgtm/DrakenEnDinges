// Spelbestand: de volledige spelstand als tekst (JSON) met een versienummer.
// Wordt gebruikt voor het bestand (bewaren/laden) én voor de automatische reservekopie in de browser.
// Oude bestanden moeten na app-updates blijven werken: verhoog SAVE_VERSION en voeg een stap toe in migrate().

import { MAX_FRIES, MAX_HEROES, type Game, type Hero } from './state';

export const APP_ID = 'draken-en-dinges';
export const SAVE_VERSION = 3;

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
  return g;
}

/** Versie 2: helden kregen een "rolled"-slot (één worp per beurt). Oude spellen: nog niemand heeft gerold. */
/** Versie 3: beginscènes (welke nu, welke al geweest). Oude spellen: nog geen. */
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
  };
}
