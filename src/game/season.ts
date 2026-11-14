// Seizoen: één slechterik met een plan in 3 hoofdstukken + finale. Bouwstenen (slechterik, plaatsen, figuren)
// worden bij de start in het geheim en willekeurig gekozen; de inhoud zelf zit verborgen in src/content.
//
// Elk hoofdstuk eindigt met een beslissend moment: elke held rolt 1×, de groep heeft een aantal successen nodig.
//   alles gelukt → meter −1 + aanwijzing · genoeg gelukt → aanwijzing · mislukt → meter +2
// Voorsprong: een goede avond telt mee, niet enkel de laatste worpen. Elke geslaagde worp tijdens het hoofdstuk
// geeft 1 voorsprong-ster (max. 2), "doel gehaald" geeft er 1 bij. Elke ster telt als een succes.
// Finale: de slechterik heeft levens (meer bij een hoge meter, minder per aanwijzing). Rondes tot hij verslagen is:
// altijd winbaar, een hoge meter maakt het enkel langer en spannender.

export const CHAPTERS = 3;
/** Scènes per hoofdstuk: 0 = begin, 1 = wending, 2 = beslissend moment. */
export const SCENES = 3;
export const MOMENT_SCENE = SCENES - 1;
export const METER_MAX = 6;
export const MOMENT_TARGET = 4;
export const MAX_LEAD_FROM_ROLLS = 2;
/** Plaatsen per seizoen: één per hoofdstuk + één voor de finale. */
export const PLACES_PER_SEASON = CHAPTERS + 1;
export const FIGURES_PER_SEASON = CHAPTERS;

export type ChapterResult = 'perfect' | 'gehaald' | 'mislukt';

export interface Season {
  villain: number;
  places: number[];
  figures: number[];
  /** 0..CHAPTERS-1 = hoofdstuk, CHAPTERS = finale. */
  chapter: number;
  meter: number;
  /** Aantal gevonden aanwijzingen over de zwakte van de slechterik. */
  clues: number;
  results: ChapterResult[];
  /** Het beslissende moment van dit hoofdstuk is al gespeeld (volgende sessie = volgend hoofdstuk). */
  momentDone: boolean;
  /** De beloning (een voorwerp) na een gelukt beslissend moment is al gegeven. */
  rewardTaken: boolean;
  /** Huidige scène in het hoofdstuk (0 = begin, 1 = wending, 2 = beslissend moment). */
  scene: number;
  /** Voorsprong-sterren uit geslaagde worpen in dit hoofdstuk (0..MAX_LEAD_FROM_ROLLS). */
  leadRolls: number;
  /** De groep zei: doel van vandaag gehaald (+1 voorsprong). */
  goalMet: boolean;
  /** Finale: resterende levens van de slechterik (null = finale nog niet begonnen). */
  hearts: number | null;
  /** Levens bij de start van de finale (voor de weergave). */
  heartsStart: number | null;
  finished: boolean;
}

export interface ContentCounts {
  villains: number;
  places: number;
  figures: number;
}

function shuffled(n: number, rng: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Kiest in het geheim een slechterik (nog niet gespeeld, tenzij ze allemaal geweest zijn), plaatsen en figuren. */
export function newSeason(usedVillains: readonly number[], counts: ContentCounts, rng: () => number = Math.random): Season {
  if (counts.villains < 1 || counts.places < PLACES_PER_SEASON || counts.figures < FIGURES_PER_SEASON) {
    throw new Error('Er is niet genoeg verhaalinhoud voor een seizoen');
  }
  const fresh = shuffled(counts.villains, rng).filter((v) => !usedVillains.includes(v));
  const villain = fresh.length > 0 ? fresh[0] : shuffled(counts.villains, rng)[0];
  return {
    villain,
    places: shuffled(counts.places, rng).slice(0, PLACES_PER_SEASON),
    figures: shuffled(counts.figures, rng).slice(0, FIGURES_PER_SEASON),
    chapter: 0,
    meter: 0,
    clues: 0,
    results: [],
    momentDone: false,
    scene: 0,
    rewardTaken: false,
    leadRolls: 0,
    goalMet: false,
    hearts: null,
    heartsStart: null,
    finished: false,
  };
}

export function isFinale(season: Season): boolean {
  return season.chapter >= CHAPTERS;
}

/** Wie rolt er bij een beslissend moment? Elke held, plus een bondgenoot als jullie maar met 1 of 2 zijn. */
export function rollerCount(present: number): number {
  return present + (present <= 2 ? 1 : 0);
}

export function hasAlly(present: number): boolean {
  return present <= 2;
}

/** Hoeveel successen zijn er nodig? De helft (naar boven), +1 als de slechterik al ver staat (meter 3+). */
export function neededSuccesses(rollers: number, meter: number): number {
  return Math.min(rollers, Math.ceil(rollers / 2) + (meter >= 3 ? 1 : 0));
}

/** Een geslaagde worp tijdens het hoofdstuk. Geeft true terug als dat een voorsprong-ster opleverde. */
/** Verder in het verhaal: naar de volgende scène (tot aan het beslissende moment). */
export function advanceScene(season: Season): void {
  if (isFinale(season) || season.momentDone) return;
  season.scene = Math.min(MOMENT_SCENE, season.scene + 1);
}

export function addLead(season: Season): boolean {
  if (isFinale(season) || season.momentDone || season.leadRolls >= MAX_LEAD_FROM_ROLLS) return false;
  season.leadRolls += 1;
  return true;
}

export function leadTotal(season: Season): number {
  return season.leadRolls + (season.goalMet ? 1 : 0);
}

/** `diceSuccesses` = geslaagde worpen bij het moment zelf; de voorsprong telt er automatisch bij. */
export function resolveMoment(season: Season, diceSuccesses: number, rollers: number): ChapterResult {
  if (isFinale(season) || season.momentDone) throw new Error('Geen beslissend moment meer in dit hoofdstuk');
  season.scene = MOMENT_SCENE;
  const successes = Math.min(rollers, diceSuccesses + leadTotal(season));
  const result: ChapterResult =
    successes >= rollers ? 'perfect' : successes >= neededSuccesses(rollers, season.meter) ? 'gehaald' : 'mislukt';
  if (result === 'perfect') season.meter = Math.max(0, season.meter - 1);
  if (result === 'mislukt') season.meter = Math.min(METER_MAX, season.meter + 2);
  if (result !== 'mislukt') season.clues = Math.min(CHAPTERS, season.clues + 1);
  season.results.push(result);
  season.momentDone = true;
  return result;
}

/** Volgende sessie: naar het volgende hoofdstuk (of de finale), enkel als het beslissende moment gespeeld is. */
export function advanceChapter(season: Season): void {
  if (!season.momentDone || isFinale(season)) return;
  season.chapter += 1;
  season.momentDone = false;
  season.scene = 0;
  season.rewardTaken = false;
  season.leadRolls = 0;
  season.goalMet = false;
}

export function finaleHearts(meter: number, clues: number, present: number): number {
  return Math.max(1, 2 + Math.ceil(meter / 2) + (present >= 4 ? 1 : 0) - clues);
}

export function startFinale(season: Season, present: number): void {
  if (!isFinale(season) || season.hearts !== null) return;
  season.hearts = finaleHearts(season.meter, season.clues, present);
  season.heartsStart = season.hearts;
}

/** Eén finaleronde: elk succes kost de slechterik een leven. Geeft true terug als hij verslagen is. */
export function finaleRound(season: Season, successes: number): boolean {
  if (season.hearts === null || season.finished) throw new Error('De finale is niet bezig');
  season.hearts = Math.max(0, season.hearts - successes);
  if (season.hearts === 0) season.finished = true;
  return season.finished;
}
