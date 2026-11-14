// Vorm van de verborgen seizoensinhoud (slechteriken, plaatsen, figuren) + het invullen van bouwstenen.
// In teksten mogen deze plaatshouders staan: {slechterik} {handlanger} {plaats} {figuur}.
// Per hoofdstuk i: {plaats} = plaats i, {figuur} = figuur i. Finale: {plaats} = de laatste plaats, {figuur} = figuur 0.

/** Een scène om voor te lezen: een concrete situatie die eindigt met een vraag aan de helden. */
export interface Scene {
  tekst: string;
  /** 2–3 mogelijke aanpakken, verborgen tot iemand op "Ideeën" tikt. */
  ideeen: string[];
}

export interface SeasonStep {
  titel: string;
  /** Precies 2 scènes: [0] het begin (waar staan jullie, wat gebeurt er net), [1] de wending (iets onverwachts). */
  scenes: Scene[];
  /** "Jullie doel vandaag": concreet en haalbaar in één avond (bv. "Vind X vóór Y"). */
  doel: string;
  /** Uitleg bij het beslissende moment. */
  moment: string;
  gelukt: string;
  mislukt: string;
}

export interface VillainContent {
  naam: string;
  /** Eerste kennismaking (begin van hoofdstuk 1). */
  intro: string;
  /** Wat hij uiteindelijk wil. */
  doel: string;
  handlanger: string;
  stappen: SeasonStep[];
  zwakte: string;
  aanwijzingen: string[];
  finale: {
    tekst: string;
    /** Wat de slechterik doet na een finaleronde die hem niet verslaat (wordt rondgedraaid). */
    rondes: string[];
    gewonnen: string;
  };
}

export interface NamedThing {
  naam: string;
  beschrijving: string;
}

export interface SeasonContent {
  /** true = saaie testinhoud (blok 4); de app toont dan "TESTVERHAAL". */
  test?: boolean;
  slechteriken: VillainContent[];
  plaatsen: NamedThing[];
  figuren: NamedThing[];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isStrList(v: unknown, min: number): v is string[] {
  return Array.isArray(v) && v.length >= min && v.every(isStr);
}

function isNamed(v: unknown): v is NamedThing {
  return isRecord(v) && isStr(v.naam) && isStr(v.beschrijving);
}

function isScene(v: unknown): v is Scene {
  return isRecord(v) && isStr(v.tekst) && isStrList(v.ideeen, 2);
}

export const STORY_SCENES = 2;

function isStep(v: unknown): v is SeasonStep {
  return (
    isRecord(v) &&
    ['titel', 'doel', 'moment', 'gelukt', 'mislukt'].every((k) => isStr(v[k])) &&
    Array.isArray(v.scenes) &&
    v.scenes.length === STORY_SCENES &&
    v.scenes.every(isScene)
  );
}

function isVillain(v: unknown, chapters: number): v is VillainContent {
  if (!isRecord(v)) return false;
  const f = v.finale;
  return (
    ['naam', 'intro', 'doel', 'handlanger', 'zwakte'].every((k) => isStr(v[k])) &&
    Array.isArray(v.stappen) &&
    v.stappen.length === chapters &&
    v.stappen.every(isStep) &&
    isStrList(v.aanwijzingen, chapters) &&
    isRecord(f) &&
    isStr(f.tekst) &&
    isStr(f.gewonnen) &&
    isStrList(f.rondes, 1)
  );
}

export function isSeasonContent(chapters: number, places: number, figures: number) {
  return (v: unknown): v is SeasonContent =>
    isRecord(v) &&
    (v.test === undefined || typeof v.test === 'boolean') &&
    Array.isArray(v.slechteriken) &&
    v.slechteriken.length > 0 &&
    v.slechteriken.every((s) => isVillain(s, chapters)) &&
    Array.isArray(v.plaatsen) &&
    v.plaatsen.length >= places &&
    v.plaatsen.every(isNamed) &&
    Array.isArray(v.figuren) &&
    v.figuren.length >= figures &&
    v.figuren.every(isNamed);
}

/** Vult {slechterik}, {handlanger}, {plaats}, {figuur} in. Onbekende plaatshouders blijven staan. */
export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole);
}
