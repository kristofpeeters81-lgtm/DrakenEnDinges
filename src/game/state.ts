// De spelstand: helden, sessies, beurt en frietjes. Pure functies die het spel-object aanpassen;
// bewaren (automatisch en als bestand) gebeurt elders.

import { isListedPower } from '../data/ideas';
import { emptyStats, type GuestTemplate, type HeroStats } from '../data/growth-data';
import { applyCard, checkTitles, grantLevelUp, groupLevel, itemUses, titleName, type Buddy, type CardChoice, type CardKind } from './growth';
import { advanceChapter, advanceScene, recordAction, finaleRound, isFinale, newSeason, resolveMoment, rollerCount, startFinale, type ChapterResult, type ContentCounts, type Season } from './season';

export const MAX_HEROES = 6;
export const START_FRIES = 3;
export const MAX_FRIES = 8;
export const MAX_ITEMS = 6;

/** Een voorwerp in de rugzak: nummer in de verborgen voorwerpenlijst, niveau (1 roestig … 3 legendarisch)
 *  en hoe vaak het deze sessie al gebruikt is (mag zo vaak als het niveau). */
export interface HeroItem {
  item: number;
  level: number;
  usedCount: number;
}

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
  /** Hoe vaak de kracht deze sessie al gebruikt is (max. powerMax). */
  powerUsedCount: number;
  /** Heeft al gerold sinds het begin van zijn laatste eigen beurt (slot tegen opnieuw rollen zonder frietje). */
  rolled: boolean;
  /** Zotte pech van dit moment (tot de volgende scène), of null. */
  pech: string | null;
  items: HeroItem[];
  // ---- groei ----
  level: number;
  /** Level-ups die nog gekozen moeten worden (na een sessie, of voor een nieuwe held op groepsniveau). */
  pendingLevelUps: number;
  /** Extra "goed in" uit level-ups. */
  extraGood: string[];
  /** Zoveel keer per sessie mag de kracht (1 of 2). */
  powerMax: number;
  /** Extra frietjes bij de start van elke sessie. */
  bonusFries: number;
  buddy: Buddy | null;
  stats: HeroStats;
  titles: string[];
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
  // Nieuwe held start op het niveau van de groep die meespeelt: de ontbrekende level-ups mag hij meteen kiezen.
  const playing = presentHeroes(game);
  const level = groupLevel((playing.length > 0 ? playing : game.heroes).map((h) => h.level));
  const hero: Hero = {
    id: newId(),
    ...clean(draft),
    present: true,
    fries: START_FRIES,
    powerUsedCount: 0,
    rolled: false,
    pech: null,
    items: [],
    level: 1,
    pendingLevelUps: level - 1,
    extraGood: [],
    powerMax: 1,
    bonusFries: 0,
    buddy: null,
    stats: emptyStats(),
    titles: [],
  };
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
    hero.fries = Math.max(hero.fries, START_FRIES + hero.bonusFries);
    hero.powerUsedCount = 0;
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
    hero.fries = START_FRIES + hero.bonusFries;
    hero.powerUsedCount = 0;
    hero.rolled = false;
    hero.pech = null;
    for (const it of hero.items) it.usedCount = 0;
    if (hero.buddy) hero.buddy.usedCount = 0;
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
  const present = presentHeroes(game);
  if (isFinale(game.season)) startFinale(game.season, present.length, groupLevel(present.map((h) => h.level)));
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
/** Een actie in de huidige scène is afgerond. Geeft de uitkomst van de scène terug als die nu vaststaat. */
export function recordSceneAction(game: Game, hero: string, action: number, text: string, success: boolean): boolean | null {
  const outcome = recordAction(requireSeason(game), { hero, action, text, success });
  touch(game);
  return outcome;
}

export function nextScene(game: Game): void {
  advanceScene(requireSeason(game));
  // Zotte pech duurt tot de volgende scène.
  for (const hero of game.heroes) hero.pech = null;
  touch(game);
}

/** Beloning na een gelukt beslissend moment: één keer per hoofdstuk. */
export function takeReward(game: Game): boolean {
  const season = requireSeason(game);
  if (!season.momentDone || season.rewardTaken || season.results[season.chapter] === 'mislukt') return false;
  season.rewardTaken = true;
  touch(game);
  return true;
}


/** Beslissend moment van het huidige hoofdstuk afronden. */
export function recordMoment(game: Game, successes: number): ChapterResult {
  const result = resolveMoment(requireSeason(game), successes, rollerCount(presentHeroes(game).length));
  if (result === 'perfect') for (const h of presentHeroes(game)) bump(h, 'perfects');
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
  if (game.sessionActive) for (const h of presentHeroes(game)) grantLevelUp(h);
  game.sessionActive = false;
  touch(game);
}

// ---------- groei: titels, level-ups, gasten ----------

/** Nieuwe titels sinds de laatste keer opvragen (voor een feestelijke melding; wordt niet bewaard). */
let titleNews: string[] = [];

export function takeTitleNews(): string[] {
  const out = titleNews;
  titleNews = [];
  return out;
}

function bump(hero: Hero, stat: keyof HeroStats, by = 1): void {
  hero.stats[stat] += by;
  for (const id of checkTitles(hero)) titleNews.push(`${hero.name}: ${titleName(id)}!`);
}

/** Een worp (gewoon of groepsworp) is afgerond: telt mee voor titels. */
export function recordRollStat(game: Game, id: string, success: boolean): void {
  if (success) bump(findHero(game, id), 'successes');
  touch(game);
}

export function chooseLevelCard(game: Game, id: string, card: CardKind, choice: CardChoice = {}): string | null {
  const error = applyCard(findHero(game, id), card, choice);
  if (!error) touch(game);
  return error;
}

/** Kant-en-klare gast: meteen speelbaar, op het niveau van de groep. */
export function addGuest(game: Game, guest: GuestTemplate): Hero {
  return addHero(game, { name: guest.name, player: 'Gast', kind: guest.kind, goodAt: [guest.goodAt[0], guest.goodAt[1]], badAt: guest.badAt, power: guest.power, powerApproved: false });
}

export function canUsePower(hero: Hero): boolean {
  return hero.powerUsedCount < hero.powerMax;
}

export function usePower(game: Game, id: string): boolean {
  const hero = findHero(game, id);
  if (!canUsePower(hero)) return false;
  hero.powerUsedCount += 1;
  touch(game);
  return true;
}

export function undoPower(game: Game, id: string): void {
  const hero = findHero(game, id);
  hero.powerUsedCount = Math.max(0, hero.powerUsedCount - 1);
  touch(game);
}

export function canUseBuddy(hero: Hero): boolean {
  return hero.buddy !== null && hero.buddy.usedCount < hero.buddy.stage;
}

export function useBuddy(game: Game, id: string): boolean {
  const hero = findHero(game, id);
  if (!hero.buddy || !canUseBuddy(hero)) return false;
  hero.buddy.usedCount += 1;
  touch(game);
  return true;
}

export function itemUsable(it: HeroItem): boolean {
  return it.usedCount < itemUses(it.level);
}

/** Opdracht gedaan: +1 frietje en telt mee voor titels. */
export function recordTask(game: Game, id: string): boolean {
  const ok = addFry(game, id);
  if (ok) bump(findHero(game, id), 'tasks');
  return ok;
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
  bump(hero, 'friesEaten');
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

export function setPech(game: Game, id: string, pech: string | null): void {
  const hero = findHero(game, id);
  hero.pech = pech;
  if (pech) {
    bump(hero, 'pech');
    if (pech.includes('kip')) bump(hero, 'kip');
  }
  touch(game);
}

/** Alle voorwerpen die iemand al heeft (om dubbels te vermijden). */
export function ownedItems(game: Game): number[] {
  return game.heroes.reduce<number[]>((acc, h) => acc.concat(h.items.map((i) => i.item)), []);
}

/** Stopt een voorwerp in de rugzak. False als de rugzak vol is of iemand het al heeft. */
export function giveItem(game: Game, id: string, item: number): boolean {
  const hero = findHero(game, id);
  if (hero.items.length >= MAX_ITEMS || ownedItems(game).includes(item)) return false;
  hero.items.push({ item, level: 1, usedCount: 0 });
  bump(hero, 'finds');
  touch(game);
  return true;
}

/** Gebruikt een voorwerp (zo vaak per sessie als zijn niveau): de worp telt als "goed in". */
export function useItem(game: Game, id: string, slot: number): boolean {
  const it = findHero(game, id).items[slot];
  if (!it || !itemUsable(it)) return false;
  it.usedCount += 1;
  touch(game);
  return true;
}

/** Is er iets veranderd sinds de laatste keer bewaren als bestand? */
export function hasUnsavedChanges(game: Game): boolean {
  return game.heroes.length > 0 && (game.lastFileSave === null || game.updatedAt > game.lastFileSave);
}

export function markFileSaved(game: Game, now: number = Date.now()): void {
  game.lastFileSave = Math.max(now, game.updatedAt);
}
