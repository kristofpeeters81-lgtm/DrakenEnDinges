// Vorm van de verborgen seizoensinhoud (slechteriken, plaatsen, figuren) + het invullen van bouwstenen.
// In teksten mogen deze plaatshouders staan: {slechterik} {handlanger} {plaats} {figuur}.
// Per hoofdstuk i: {plaats} = plaats i, {figuur} = figuur i. Finale: {plaats} = de laatste plaats, {figuur} = figuur 0.

export interface KeyApproach {
  /** Een concrete aanpak, bv. "Hem achternarennen over de markt". */
  label: string;
  /** Bij welke talenten het past, bv. "snel lopen, klimmen". */
  past: string;
}

/** Sleutelmoment op het einde van een scène: wat staat er op het spel, hoe pakken jullie het aan, en wat volgt eruit. */
export interface KeyMoment {
  vraag: string;
  aanpakken: KeyApproach[];
  /** Gevolg als de worp lukt / mislukt (het verhaal gaat altijd verder). */
  gelukt: string;
  mislukt: string;
}

/** Een scène om voor te lezen: een concrete situatie die eindigt met een vraag aan de helden. */
export interface Scene {
  tekst: string;
  /** 2–3 hints, verborgen tot iemand op "Ideeën" tikt. */
  ideeen: string[];
  sleutel: KeyMoment;
}

/** Een hoofdstuk met vertakkingen:
 *  begin → sleutelmoment 1 → wending.gelukt of wending.mislukt → sleutelmoment 2 → moment.gelukt of moment.mislukt. */
export interface SeasonStep {
  titel: string;
  /** "Jullie doel vandaag": concreet en haalbaar in één avond (bv. "Vind X vóór Y"). */
  doel: string;
  begin: Scene;
  wending: { gelukt: Scene; mislukt: Scene };
  /** De climax, gekozen door de uitkomst van sleutelmoment 2 (moet passen na beide wendingen). */
  moment: { gelukt: string; mislukt: string };
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

function isKey(v: unknown): v is KeyMoment {
  return (
    isRecord(v) &&
    isStr(v.vraag) &&
    isStr(v.gelukt) &&
    isStr(v.mislukt) &&
    Array.isArray(v.aanpakken) &&
    v.aanpakken.length >= 2 &&
    v.aanpakken.every((a) => isRecord(a) && isStr(a.label) && isStr(a.past))
  );
}

function isScene(v: unknown): v is Scene {
  return isRecord(v) && isStr(v.tekst) && isStrList(v.ideeen, 2) && isKey(v.sleutel);
}

function isBranch<T>(v: unknown, each: (x: unknown) => x is T): v is { gelukt: T; mislukt: T } {
  return isRecord(v) && each(v.gelukt) && each(v.mislukt);
}

function isStep(v: unknown): v is SeasonStep {
  return (
    isRecord(v) &&
    ['titel', 'doel', 'gelukt', 'mislukt'].every((k) => isStr(v[k])) &&
    isScene(v.begin) &&
    isBranch(v.wending, isScene) &&
    isBranch(v.moment, isStr)
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
