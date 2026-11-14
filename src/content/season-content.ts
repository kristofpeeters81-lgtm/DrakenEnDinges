// Vorm van de verborgen seizoensinhoud (slechteriken, plaatsen, figuren) + het invullen van bouwstenen.
// In teksten mogen deze plaatshouders staan: {slechterik} {handlanger} {plaats} {figuur}.
// Per hoofdstuk i: {plaats} = plaats i, {figuur} = figuur i. Finale: {plaats} = de laatste plaats, {figuur} = figuur 0.

export interface SeasonStep {
  titel: string;
  /** Wat de slechterik nu van plan is (begin van het hoofdstuk). */
  tekst: string;
  /** "Jullie doel vandaag". */
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

function isStep(v: unknown): v is SeasonStep {
  return isRecord(v) && ['titel', 'tekst', 'doel', 'moment', 'gelukt', 'mislukt'].every((k) => isStr(v[k]));
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
