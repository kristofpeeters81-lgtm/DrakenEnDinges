// Ideeënlijsten voor het aanmaakscherm. Zelfde lijsten als op de achterkant van de regelkaart (public/print/regelkaart.html):
// pas ze op beide plaatsen aan. Dit is geen spoilerinhoud.

export const HERO_NAMES = [
  'Sir Pruttelbroek',
  'Mevrouw Kwak',
  'Jefke de Dappere',
  'Prinses Modderpoot',
  'Trol Gerard',
  'Ridder Wiebel',
  'Heks Hilda Haarbal',
  'Tovenaar Zeverkop',
  'Mie Mosselman',
  'Baron van Snotterbeek',
  'Bompa Bliksem',
  'Tante Tuttebel',
  'Sjarel Snelvoet',
  'Lady Lekkerbek',
  'Fritske',
  'Rosalie Rammelbuik',
  'Pierke Pierewiet',
  'Kapitein Kaaskop',
] as const;

export const KINDS = [
  'Ridder met hoogtevrees',
  'Heks die bang is van katten',
  'Trol die koekjes bakt',
  'Prinses die liever in de modder speelt',
  'Tovenaar zonder wenkbrauwen',
  'Draak die vegetariër is',
  'Piraat die zeeziek wordt',
  'Robotridder van karton',
  'Eenhoorn met hooikoorts',
  'Spook dat niet eng kan doen',
  'Kabouter met grootheidswaan',
  'Frietbakker uit Scheetegem',
] as const;

export const GOOD_AT = [
  'Klimmen',
  'Sluipen',
  'Snel lopen',
  'Hard roepen',
  'Zeveren (iemand ompraten)',
  'Toveren',
  'Koken',
  'Dieren temmen',
  'Slimme plannen',
  'Dansen',
  'Ruiken',
  'Vechten met een pollepel',
] as const;

export const BAD_AT = [
  'Stil zijn',
  'Tellen',
  'Niet lachen',
  'Stilzitten',
  'Zwemmen',
  'Liegen',
  'Onthouden',
  'Links en rechts',
  'Wakker blijven',
  'Delen',
  'Geheimen bewaren',
  'Wachten',
] as const;

export const POWERS = [
  '1 minuut onzichtbaar',
  'Met dieren praten',
  'Een scheet zo hard als een storm',
  'Iets laten zweven',
  'Iets uit uw broekzak halen dat ge nét nodig hebt',
  'Iemand in slaap zingen',
  'Door een muur wandelen',
  'Even 3× zo groot worden',
  'In 1 seconde een put graven',
  'Iedereen doen lachen — zelfs de slechterik',
  'Vliegen (maar alleen achteruit)',
  'De tijd 5 seconden terugdraaien',
] as const;

/** Kiest willekeurig uit een lijst, maar nooit een van de waarden in `avoid` (tenzij er niets anders over is). */
export function pick(list: readonly string[], avoid: readonly string[] = [], rng: () => number = Math.random): string {
  const norm = (s: string): string => s.trim().toLowerCase();
  const blocked = new Set(avoid.map(norm));
  const options = list.filter((item) => !blocked.has(norm(item)));
  const pool = options.length > 0 ? options : list;
  return pool[Math.floor(rng() * pool.length)];
}

/** Staat deze kracht in de goedgekeurde lijst? Zo niet, dan moet de tafel ze goedkeuren. */
export function isListedPower(power: string): boolean {
  const p = power.trim().toLowerCase();
  return POWERS.some((item) => item.toLowerCase() === p);
}
