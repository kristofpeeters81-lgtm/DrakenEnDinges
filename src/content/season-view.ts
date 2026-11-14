// Maakt van een seizoen (enkel nummers in het spelbestand) leesbare teksten, met de bouwstenen ingevuld.

import { CHAPTERS, FIGURES_PER_SEASON, PLACES_PER_SEASON, type ContentCounts, type Season } from '../game/season';
import { decodeContent } from './codec';
import { fill, isSeasonContent, type Scene, type SeasonContent, type VillainContent } from './season-content';
import { DATA as SEIZOENEN } from './seizoenen.data';

let content: SeasonContent | null = null;

function all(): SeasonContent {
  if (!content) content = decodeContent(SEIZOENEN, isSeasonContent(CHAPTERS, PLACES_PER_SEASON, FIGURES_PER_SEASON));
  return content;
}

export function seasonCounts(): ContentCounts {
  const c = all();
  return { villains: c.slechteriken.length, places: c.plaatsen.length, figures: c.figuren.length };
}

/** true zolang het echte verhaal er nog niet is (blok 4: testinhoud). */
export function isTestContent(): boolean {
  return all().test === true;
}

function villain(season: Season): VillainContent {
  const v = all().slechteriken[season.villain];
  if (!v) throw new Error('Deze slechterik bestaat niet (meer) in de verhaalinhoud');
  return v;
}

/** Plaatshouders voor hoofdstuk `chapter` (CHAPTERS = finale). */
function vars(season: Season, chapter: number): Record<string, string> {
  const c = all();
  const v = villain(season);
  const place = c.plaatsen[season.places[Math.min(chapter, season.places.length - 1)]];
  const figure = c.figuren[season.figures[chapter >= CHAPTERS ? 0 : chapter]];
  return { slechterik: v.naam, handlanger: v.handlanger, plaats: place?.naam ?? '', figuur: figure?.naam ?? '' };
}

export function villainName(season: Season): string {
  return villain(season).naam;
}

export interface ChapterView {
  number: number;
  titel: string;
  /** "Vorige keer…" (null in hoofdstuk 1). */
  recap: string | null;
  /** Enkel in hoofdstuk 1: kennismaking met de slechterik en wat hij wil. */
  intro: string | null;
  /** De gespeelde/huidige scènes: [0] het begin, [1] de wending in de versie die bij sleutelmoment 1 hoort. */
  scenes: SceneView[];
  doel: string;
  plaats: { naam: string; beschrijving: string };
  figuur: { naam: string; beschrijving: string };
  /** De climax in de versie die bij sleutelmoment 2 hoort (null zolang dat nog niet gespeeld is). */
  moment: string | null;
}

export interface SceneView {
  tekst: string;
  ideeen: string[];
  sleutel: { vraag: string; aanpakken: Array<{ label: string; past: string }>; gelukt: string; mislukt: string };
}

function sceneView(sc: Scene, vv: Record<string, string>): SceneView {
  return {
    tekst: fill(sc.tekst, vv),
    ideeen: sc.ideeen.map((i) => fill(i, vv)),
    sleutel: {
      vraag: fill(sc.sleutel.vraag, vv),
      aanpakken: sc.sleutel.aanpakken.map((a) => ({ label: fill(a.label, vv), past: fill(a.past, vv) })),
      gelukt: fill(sc.sleutel.gelukt, vv),
      mislukt: fill(sc.sleutel.mislukt, vv),
    },
  };
}

function recapOf(season: Season, chapter: number): string | null {
  if (chapter === 0) return null;
  const prev = villain(season).stappen[chapter - 1];
  const result = season.results[chapter - 1];
  if (!prev || !result) return null;
  return fill(result === 'mislukt' ? prev.mislukt : prev.gelukt, vars(season, chapter - 1));
}

export function chapterView(season: Season): ChapterView {
  const c = all();
  const v = villain(season);
  const i = season.chapter;
  const step = v.stappen[i];
  const vv = vars(season, i);
  return {
    number: i + 1,
    titel: fill(step.titel, vv),
    recap: recapOf(season, i),
    intro: i === 0 ? `${fill(v.intro, vv)} ${fill(v.doel, vv)}` : null,
    scenes: [
      sceneView(step.begin, vv),
      ...(season.keys.length >= 1 ? [sceneView(season.keys[0] ? step.wending.gelukt : step.wending.mislukt, vv)] : []),
    ],
    doel: fill(step.doel, vv),
    plaats: c.plaatsen[season.places[i]],
    figuur: c.figuren[season.figures[i]],
    moment: season.keys.length >= 2 ? fill(season.keys[1] ? step.moment.gelukt : step.moment.mislukt, vv) : null,
  };
}

/** Tekst na het beslissende moment van het huidige hoofdstuk. */
export function momentText(season: Season, success: boolean): string {
  const step = villain(season).stappen[season.chapter];
  return fill(success ? step.gelukt : step.mislukt, vars(season, season.chapter));
}

export function clueTexts(season: Season): string[] {
  const v = villain(season);
  return v.aanwijzingen.slice(0, season.clues).map((t) => fill(t, vars(season, CHAPTERS)));
}

export interface FinaleView {
  recap: string | null;
  tekst: string;
  /** De zwakte, enkel als jullie minstens 2 aanwijzingen vonden. */
  zwakte: string | null;
  plaats: { naam: string; beschrijving: string };
}

export function finaleView(season: Season): FinaleView {
  const c = all();
  const v = villain(season);
  const vv = vars(season, CHAPTERS);
  return {
    recap: recapOf(season, CHAPTERS),
    tekst: fill(v.finale.tekst, vv),
    zwakte: season.clues >= 2 ? fill(v.zwakte, vv) : null,
    plaats: c.plaatsen[season.places[CHAPTERS]],
  };
}

/** Wat de slechterik doet na finaleronde `round` (0-gebaseerd), rondgedraaid. */
export function finaleRoundText(season: Season, round: number): string {
  const rondes = villain(season).finale.rondes;
  return fill(rondes[round % rondes.length], vars(season, CHAPTERS));
}

export function finaleWonText(season: Season): string {
  return fill(villain(season).finale.gewonnen, vars(season, CHAPTERS));
}
