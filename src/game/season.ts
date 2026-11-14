// Seizoen: één slechterik met een plan in 3 hoofdstukken + finale. Bouwstenen (slechterik, plaatsen, figuren)
// worden bij de start in het geheim en willekeurig gekozen; de inhoud zelf zit verborgen in src/content.
//
// Elk hoofdstuk eindigt met een beslissend moment: elke held rolt 1×, de groep heeft een aantal successen nodig.
//   alles gelukt → meter −1 + aanwijzing · genoeg gelukt → aanwijzing · mislukt → meter +2
// Acties: in elke scène (begin, wending) kiest wie aan de beurt is een actie uit de lijst (of "iets anders", via de
// Pruttelpot) en rolt. Elke gelukte actie vult de voortgang; SCENE_GOAL gelukt binnen SCENE_TURNS beurten = scène
// gelukt, beurten op = scène mislukt. Die uitkomst bepaalt welke versie van het verhaal volgt (vertakking) en geeft
// voorsprong: 1 ster per gelukte scène, +1 als ze allebei lukten. Elke ster telt als een succes bij het beslissende
// moment. Een mislukte actie mag opnieuw, een gelukte niet. Alles komt in het logboek van het hoofdstuk.
// Finale: de slechterik heeft levens (meer bij een hoge meter, minder per aanwijzing). Rondes tot hij verslagen is:
// altijd winbaar, een hoge meter maakt het enkel langer en spannender.

export const CHAPTERS = 3;
/** Scènes per hoofdstuk: 0 = begin, 1 = wending, 2 = beslissend moment. */
export const SCENES = 3;
export const MOMENT_SCENE = SCENES - 1;
export const METER_MAX = 6;
export const MOMENT_TARGET = 4;
/** Scènes met acties per hoofdstuk (het begin en de wending); hun uitkomst bepaalt de vertakking. */
export const KEY_MOMENTS = MOMENT_SCENE;
export const SCENE_GOAL = 2;
export const SCENE_TURNS = 5;
/** Actie-nummer voor een eigen idee ("iets anders"). */
export const OWN_IDEA = -1;

/** Eén regel in het verhaallogboek van een hoofdstuk. */
export interface LogEntry {
  scene: number;
  hero: string;
  /** Nummer van de actie in de lijst, of OWN_IDEA. */
  action: number;
  /** Wat de spelers zelf intypten bij een eigen idee (anders leeg). */
  text: string;
  success: boolean;
}
export const MAX_LEAD = KEY_MOMENTS + 1;
/** Plaatsen per seizoen: één per hoofdstuk + één voor de finale. */
export const PLACES_PER_SEASON = CHAPTERS + 1;
export const FIGURES_PER_SEASON = CHAPTERS;

export type ChapterResult = 'perfect' | 'gehaald' | 'mislukt';

/** Wat een gespeeld hoofdstuk bijhoudt — een seizoenshoofdstuk én een los avontuur (zelfde regels). */
export interface SceneState {
  /** Huidige scène (0 = begin, 1 = wending, 2 = beslissend moment). */
  scene: number;
  /** Uitkomst van de scènes met acties (true = gelukt), in volgorde. Bepaalt de vertakking. */
  keys: boolean[];
  /** Verhaallogboek: elke gekozen actie met wie en hoe het afliep. */
  log: LogEntry[];
  /** Het beslissende moment is al gespeeld. */
  momentDone: boolean;
}

export interface Season extends SceneState {
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
  /** Uitkomst van de scènes met acties in dit hoofdstuk (true = gelukt), in volgorde. Bepaalt de vertakking. */
  keys: boolean[];
  /** Verhaallogboek van dit hoofdstuk: elke gekozen actie met wie en hoe het afliep. */
  log: LogEntry[];
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
    keys: [],
    log: [],
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

/** Heeft de huidige scène al een uitkomst (voortgang vol of beurten op)? */
export function keyDone(state: SceneState): boolean {
  return state.keys.length > state.scene;
}

function sceneLog(state: SceneState): LogEntry[] {
  return state.log.filter((e) => e.scene === state.scene);
}

export function sceneProgress(state: SceneState): number {
  return sceneLog(state).filter((e) => e.success).length;
}

export function turnsLeft(state: SceneState): number {
  return Math.max(0, SCENE_TURNS - sceneLog(state).length);
}

/** Is deze actie in de huidige scène al gelukt? (dan kan ze niet nog eens) */
export function actionSucceeded(state: SceneState, action: number): boolean {
  return action !== OWN_IDEA && sceneLog(state).some((e) => e.action === action && e.success);
}

/** Is deze actie in de huidige scène al eens mislukt? (dan mag ze opnieuw) */
export function actionFailed(state: SceneState, action: number): boolean {
  return action !== OWN_IDEA && sceneLog(state).some((e) => e.action === action && !e.success);
}

/** Kan er nu een actie gespeeld worden? (niet in de finale: die heeft geen scènes) */
export function canActIn(state: SceneState): boolean {
  return !state.momentDone && state.scene < MOMENT_SCENE && !keyDone(state);
}

export function canAct(season: Season): boolean {
  return !isFinale(season) && canActIn(season);
}

/** Een actie is afgerond. Geeft de uitkomst van de scène terug als die nu vaststaat (true/false), anders null. */
export function recordAction(season: SceneState, entry: Omit<LogEntry, 'scene'>): boolean | null {
  if (!canActIn(season)) throw new Error('Er kan nu geen actie gespeeld worden');
  if (actionSucceeded(season, entry.action)) throw new Error('Deze actie is al gelukt');
  season.log.push({ ...entry, text: entry.text.slice(0, 120), scene: season.scene });
  if (sceneProgress(season) >= SCENE_GOAL) season.keys.push(true);
  else if (turnsLeft(season) === 0) season.keys.push(false);
  return keyDone(season) ? season.keys[season.scene] : null;
}

/** Verder in het verhaal: naar de volgende scène, pas als het sleutelmoment van deze scène gespeeld is. */
export function advanceScene(state: SceneState): void {
  if (state.momentDone || !keyDone(state)) return;
  state.scene = Math.min(MOMENT_SCENE, state.scene + 1);
}

/** Voorsprong: 1 ster per gelukt sleutelmoment, +1 als ze allemaal lukten. */
export function leadTotal(state: SceneState): number {
  const won = state.keys.filter(Boolean).length;
  return won + (state.keys.length === KEY_MOMENTS && won === KEY_MOMENTS ? 1 : 0);
}

/** Uitkomst van een beslissend moment: dobbelsteensuccessen + voorsprong tegen het aantal nodige successen. */
export function momentResult(state: SceneState, diceSuccesses: number, rollers: number, meter: number): ChapterResult {
  const successes = Math.min(rollers, diceSuccesses + leadTotal(state));
  return successes >= rollers ? 'perfect' : successes >= neededSuccesses(rollers, meter) ? 'gehaald' : 'mislukt';
}

/** `diceSuccesses` = geslaagde worpen bij het moment zelf; de voorsprong telt er automatisch bij. */
export function resolveMoment(season: Season, diceSuccesses: number, rollers: number): ChapterResult {
  if (isFinale(season) || season.momentDone) throw new Error('Geen beslissend moment meer in dit hoofdstuk');
  season.scene = MOMENT_SCENE;
  const result = momentResult(season, diceSuccesses, rollers, season.meter);
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
  season.keys = [];
  season.log = [];
}

/** Levens in de finale. Sterkere helden (gemiddeld niveau 4, 7, 10) = de slechterik schaalt mee. */
export function finaleHearts(meter: number, clues: number, present: number, groupLevel = 1): number {
  return Math.max(1, 2 + Math.ceil(meter / 2) + (present >= 4 ? 1 : 0) + Math.floor((groupLevel - 1) / 3) - clues);
}

export function startFinale(season: Season, present: number, groupLevel = 1): void {
  if (!isFinale(season) || season.hearts !== null) return;
  season.hearts = finaleHearts(season.meter, season.clues, present, groupLevel);
  season.heartsStart = season.hearts;
}

/** Eén finaleronde: elk succes kost de slechterik een leven. Geeft true terug als hij verslagen is. */
export function finaleRound(season: Season, successes: number): boolean {
  if (season.hearts === null || season.finished) throw new Error('De finale is niet bezig');
  season.hearts = Math.max(0, season.hearts - successes);
  if (season.hearts === 0) season.finished = true;
  return season.finished;
}
