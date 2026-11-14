// De spelstand: helden, sessies, beurt en frietjes. Pure functies die het spel-object aanpassen;
// bewaren (automatisch en als bestand) gebeurt elders.

import { isListedPower } from '../data/ideas';
import { addLead, advanceChapter, finaleRound, isFinale, newSeason, resolveMoment, rollerCount, startFinale, type ChapterResult, type ContentCounts, type Season } from './season';

export const MAX_HEROES = 6;
export const START_FRIES = 3;
export const MAX_FRIES = 8;

export interface Hero {
  id: string;
  name: string;
  player: string;
  kind: string;
  goodAt: [string, string];
  badAt: string;
  power: string;
  /** Een zelfverzonnen kracht (niet uit de lijst) moet door iedereen aan tafel goedgekeurd zijn. */
  powerApproved: boolean;
  /** Speelt mee in de huidige/volgende sessie (gasten kunnen in- en uitstappen). */
  present: boolean;
  fries: number;
  powerUsed: boolean;
  /** Heeft al gerold sinds het begin van zijn laatste eigen beurt (slot tegen opnieuw rollen zonder frietje). */
  rolled: boolean;
}

export type HeroDraft = Pick<Hero, 'name' | 'player' | 'kind' | 'goodAt' | 'badAt' | 'power' | 'powerApproved'>;

export interface Game {
  id: string;
  createdAt: number;
  updatedAt: number;
  /** Nummer van de laatst gestarte sessie (0 = nog niet gespeeld). */
  session: number;
  sessionActive: boolean;
  /** Index in de lijst van meespelende helden. */
  turn: number;
  heroes: Hero[];
  /** Moment van de laatste keer bewaren als bestand (null = nog nooit). */
  lastFileSave: number | null;
  /** Beginscène van de huidige sessie (index in de verborgen lijst), of null. */
  opening: number | null;
  /** Beginscènes die al geweest zijn (pas als alles geweest is, komen ze terug). */
  usedOpenings: number[];
  /** Het lopende (of laatst gespeelde) seizoen. */
  season: Season | null;
  /** Slechteriken die al een seizoen kregen (komen pas terug als ze allemaal geweest zijn). */
  usedVillains: number[];
  /** Wat er deze sessie gespeeld wordt: een hoofdstuk van het seizoen of een los avontuur. */
  sessionMode: SessionMode | null;
}

export type SessionMode = 'seizoen' | 'los';

export function newId(rng: () => number = Math.random): string {
  return `${Date.now().toString(36)}-${Math.floor(rng() * 1e9).toString(36)}`;
}

export function newGame(now: number = Date.now()): Game {
  return { id: newId(), createdAt: now, updatedAt: now, session: 0, sessionActive: false, turn: 0, heroes: [], lastFileSave: null, opening: null, usedOpenings: [], season: null, usedVillains: [], sessionMode: null };
}

export function emptyDraft(): HeroDraft {
  return { name: '', player: '', kind: '', goodAt: ['', ''], badAt: '', power: '', powerApproved: false };
}

export function draftOf(hero: Hero): HeroDraft {
  return { name: hero.name, player: hero.player, kind: hero.kind, goodAt: [hero.goodAt[0], hero.goodAt[1]], badAt: hero.badAt, power: hero.power, powerApproved: hero.powerApproved };
}

export function needsApproval(power: string): boolean {
  return power.trim() !== '' && !isListedPower(power);
}

/** Geeft een lijst met wat er nog ontbreekt (leeg = in orde). */
export function validateDraft(d: HeroDraft): string[] {
  const errors: string[] = [];
  if (!d.name.trim()) errors.push('Geef uw held een naam.');
  if (!d.kind.trim()) errors.push('Kies een soort.');
  if (!d.goodAt[0].trim() || !d.goodAt[1].trim()) errors.push('Vul 2× "goed in" in.');
  else if (d.goodAt[0].trim().toLowerCase() === d.goodAt[1].trim().toLowerCase()) errors.push('Kies 2 verschillende dingen bij "goed in".');
  if (!d.badAt.trim()) errors.push('Vul "slecht in" in.');
  if (!d.power.trim()) errors.push('Kies een speciale kracht.');
  else if (needsApproval(d.power) && !d.powerApproved) errors.push('Iedereen aan tafel moet "ja" zeggen tegen een zelfverzonnen kracht.');
  return errors;
}

function clean(d: HeroDraft): HeroDraft {
  const power = d.power.trim();
  return {
    name: d.name.trim(),
    player: d.player.trim(),
    kind: d.kind.trim(),
    goodAt: [d.goodAt[0].trim(), d.goodAt[1].trim()],
    badAt: d.badAt.trim(),
    power,
    powerApproved: needsApproval(power) ? d.powerApproved : false,
  };
}

function touch(game: Game): void {
  game.updatedAt = Math.max(Date.now(), game.updatedAt + 1);
}

export function addHero(game: Game, draft: HeroDraft): Hero {
  if (game.heroes.length >= MAX_HEROES) throw new Error(`Maximum ${MAX_HEROES} helden`);
  const errors = validateDraft(draft);
  if (errors.length > 0) throw new Error(errors[0]);
  const hero: Hero = { id: newId(), ...clean(draft), present: true, fries: START_FRIES, powerUsed: false, rolled: false };
  game.heroes.push(hero);
  touch(game);
  return hero;
}

export function updateHero(game: Game, id: string, draft: HeroDraft): void {
  const errors = validateDraft(draft);
  if (errors.length > 0) throw new Error(errors[0]);
  const hero = findHero(game, id);
  Object.assign(hero, clean(draft));
  touch(game);
}

export function removeHero(game: Game, id: string): void {
  const current = currentHero(game);
  game.heroes = game.heroes.filter((h) => h.id !== id);
  keepTurnOn(game, current && current.id !== id ? current.id : null);
  touch(game);
}

export function findHero(game: Game, id: string): Hero {
  const hero = game.heroes.find((h) => h.id === id);
  if (!hero) throw new Error('Held niet gevonden');
  return hero;
}

export function presentHeroes(game: Game): Hero[] {
  return game.heroes.filter((h) => h.present);
}

export function currentHero(game: Game): Hero | null {
  const present = presentHeroes(game);
  if (present.length === 0) return null;
  return present[game.turn % present.length];
}

/** Zet de beurt terug op dezelfde held nadat de lijst van meespelers veranderde. */
function keepTurnOn(game: Game, heroId: string | null): void {
  const present = presentHeroes(game);
  const idx = heroId ? present.findIndex((h) => h.id === heroId) : -1;
  game.turn = idx >= 0 ? idx : present.length > 0 ? game.turn % present.length : 0;
}

export function setPresent(game: Game, id: string, present: boolean): void {
  const current = currentHero(game);
  const hero = findHero(game, id);
  hero.present = present;
  // Instappen tijdens een sessie: met een volle frietjeszak en een ongebruikte kracht.
  if (present && game.sessionActive) {
    hero.fries = Math.max(hero.fries, START_FRIES);
    hero.powerUsed = false;
    hero.rolled = false;
  }
  keepTurnOn(game, current && current.id !== id ? current.id : null);
  touch(game);
}

export function startSession(game: Game): void {
  if (presentHeroes(game).length === 0) throw new Error('Er speelt nog niemand mee');
  game.session += 1;
  game.sessionActive = true;
  game.turn = 0;
  for (const hero of game.heroes) {
    hero.fries = START_FRIES;
    hero.powerUsed = false;
    hero.rolled = false;
  }
  touch(game);
}

/** Kiest een beginscène die nog niet geweest is (uit `count` mogelijke). Zijn ze allemaal geweest: opnieuw beginnen. */
export function chooseOpening(game: Game, count: number, rng: () => number = Math.random): void {
  if (count <= 0) {
    game.opening = null;
    return;
  }
  let free = [];
  for (let i = 0; i < count; i++) if (!game.usedOpenings.includes(i) && i !== game.opening) free.push(i);
  if (free.length === 0) {
    game.usedOpenings = game.opening === null ? [] : [game.opening];
    free = [];
    for (let i = 0; i < count; i++) if (i !== game.opening) free.push(i);
    if (free.length === 0) free = [0];
  }
  const pick = free[Math.floor(rng() * free.length)];
  game.opening = pick;
  if (!game.usedOpenings.includes(pick)) game.usedOpenings.push(pick);
  touch(game);
}

/** Kan er een seizoen verder gespeeld worden (begonnen en nog niet uit)? */
export function seasonInProgress(game: Game): boolean {
  return game.season !== null && !game.season.finished;
}

/** Na startSession: deze sessie is een hoofdstuk van het seizoen. Start zo nodig een nieuw seizoen,
 *  gaat naar het volgende hoofdstuk als het vorige beslissende moment gespeeld is, of start de finale. */
export function beginSeasonSession(game: Game, counts: ContentCounts, rng: () => number = Math.random): void {
  if (!game.season || game.season.finished) {
    game.season = newSeason(game.usedVillains, counts, rng);
    if (game.usedVillains.length >= counts.villains) game.usedVillains = [];
    game.usedVillains.push(game.season.villain);
  } else {
    advanceChapter(game.season);
  }
  if (isFinale(game.season)) startFinale(game.season, presentHeroes(game).length);
  game.sessionMode = 'seizoen';
  touch(game);
}

export function beginLooseSession(game: Game): void {
  game.sessionMode = 'los';
  touch(game);
}

function requireSeason(game: Game): Season {
  if (!game.season) throw new Error('Er loopt geen seizoen');
  return game.season;
}

/** Een geslaagde gewone worp in een seizoenssessie. Geeft true terug als dat een voorsprong-ster opleverde. */
export function recordSuccessForLead(game: Game): boolean {
  if (game.sessionMode !== 'seizoen' || !game.season) return false;
  const added = addLead(game.season);
  if (added) touch(game);
  return added;
}

export function setGoalMet(game: Game, met: boolean): void {
  requireSeason(game).goalMet = met;
  touch(game);
}

/** Beslissend moment van het huidige hoofdstuk afronden. */
export function recordMoment(game: Game, successes: number): ChapterResult {
  const result = resolveMoment(requireSeason(game), successes, rollerCount(presentHeroes(game).length));
  touch(game);
  return result;
}

/** Eén finaleronde afronden. Geeft true terug als de slechterik verslagen is. */
export function recordFinaleRound(game: Game, successes: number): boolean {
  const won = finaleRound(requireSeason(game), successes);
  touch(game);
  return won;
}

export function endSession(game: Game): void {
  game.sessionActive = false;
  touch(game);
}

export function nextTurn(game: Game): void {
  const count = presentHeroes(game).length;
  game.turn = count > 0 ? (game.turn + 1) % count : 0;
  // Het slot gaat open zodra een held weer zelf aan de beurt is.
  const current = currentHero(game);
  if (current) current.rolled = false;
  touch(game);
}

/** Mag deze held nu rollen? Eén worp per held tot zijn volgende eigen beurt (opnieuw rollen kan enkel met een frietje). */
export function canRoll(game: Game, id: string): boolean {
  const hero = findHero(game, id);
  return game.sessionActive && hero.present && !hero.rolled;
}

/** Zet het slot zodra de uitkomst van een worp vaststaat. */
export function markRolled(game: Game, id: string): void {
  findHero(game, id).rolled = true;
  touch(game);
}

/** Eet een frietje op. Geeft false terug als de frietjes op zijn. */
export function eatFry(game: Game, id: string): boolean {
  const hero = findHero(game, id);
  if (hero.fries <= 0) return false;
  hero.fries -= 1;
  touch(game);
  return true;
}

export function addFry(game: Game, id: string): boolean {
  const hero = findHero(game, id);
  if (hero.fries >= MAX_FRIES) return false;
  hero.fries += 1;
  touch(game);
  return true;
}

export function setPowerUsed(game: Game, id: string, used: boolean): void {
  findHero(game, id).powerUsed = used;
  touch(game);
}

/** Is er iets veranderd sinds de laatste keer bewaren als bestand? */
export function hasUnsavedChanges(game: Game): boolean {
  return game.heroes.length > 0 && (game.lastFileSave === null || game.updatedAt > game.lastFileSave);
}

export function markFileSaved(game: Game, now: number = Date.now()): void {
  game.lastFileSave = Math.max(now, game.updatedAt);
}
