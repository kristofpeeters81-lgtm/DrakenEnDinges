// Groei: maatjes, kant-en-klare gastpersonages en titels. Geen spoilerinhoud (decor, mag iedereen zien).

export const BUDDIES = [
  { soort: 'Kip die wil leren vliegen', naam: 'Kiekeboe' },
  { soort: 'Slak met een turbo', naam: 'Zoef' },
  { soort: 'Hamster in een kermiskarretje', naam: 'Knabbel' },
  { soort: 'Mini-draakje dat hikt in plaats van vuur spuwt', naam: 'Hikkie' },
  { soort: 'Duif die alles verkeerd begrijpt', naam: 'Wablief' },
  { soort: 'Egel met een regenhoedje', naam: 'Prikkie' },
  { soort: 'Kikker die opera zingt', naam: 'Kwaakarotti' },
  { soort: 'Hond die enkel frietjes eet', naam: 'Mayo' },
  { soort: 'Uil die altijd in slaap valt', naam: 'Snurk' },
  { soort: 'Pratende pantoffel', naam: 'Sloef' },
] as const;

export const BUDDY_STAGES = ['klein', 'groter', 'straf'] as const;

export interface GuestTemplate {
  name: string;
  kind: string;
  goodAt: [string, string];
  badAt: string;
  power: string;
}

/** Kant-en-klare gasten (meteen speelbaar). Hun kracht staat in de goedgekeurde lijst. */
export const GUESTS: readonly GuestTemplate[] = [
  { name: 'Tante Frieda Frikandel', kind: 'Frietbakker uit Scheetegem', goodAt: ['Koken', 'Hard roepen'], badAt: 'Stil zijn', power: 'Iets uit uw broekzak halen dat ge nét nodig hebt' },
  { name: 'Ridder Wiebelknie', kind: 'Ridder met hoogtevrees', goodAt: ['Vechten met een pollepel', 'Slimme plannen'], badAt: 'Klimmen', power: 'Even 3× zo groot worden' },
  { name: 'Heks Bibberbezem', kind: 'Heks die bang is van katten', goodAt: ['Toveren', 'Ruiken'], badAt: 'Wachten', power: 'Iets laten zweven' },
  { name: 'Kapitein Kotsbaard', kind: 'Piraat die zeeziek wordt', goodAt: ['Zeveren (iemand ompraten)', 'Sluipen'], badAt: 'Zwemmen', power: 'Met dieren praten' },
  { name: 'Spookje Boe-Nee', kind: 'Spook dat niet eng kan doen', goodAt: ['Sluipen', 'Dansen'], badAt: 'Niet lachen', power: 'Door een muur wandelen' },
  { name: 'Prinses Moddervoet', kind: 'Prinses die liever in de modder speelt', goodAt: ['Klimmen', 'Dieren temmen'], badAt: 'Stilzitten', power: 'Iedereen doen lachen — zelfs de slechterik' },
];

export interface HeroStats {
  pech: number;
  kip: number;
  friesEaten: number;
  tasks: number;
  successes: number;
  perfects: number;
  finds: number;
}

export function emptyStats(): HeroStats {
  return { pech: 0, kip: 0, friesEaten: 0, tasks: 0, successes: 0, perfects: 0, finds: 0 };
}

export interface TitleDef {
  id: string;
  naam: string;
  waarom: string;
  earned: (s: HeroStats) => boolean;
}

export const TITLES: readonly TitleDef[] = [
  { id: 'kiek', naam: 'Kiekenkoning(in)', waarom: '3× in een kip veranderd', earned: (s) => s.kip >= 3 },
  { id: 'pechvogel', naam: 'Officiële Pechvogel van Kakofonië', waarom: '5× zotte pech', earned: (s) => s.pech >= 5 },
  { id: 'frietvreter', naam: 'Frietvreter', waarom: '10 frietjes opgegeten', earned: (s) => s.friesEaten >= 10 },
  { id: 'opdracht', naam: 'Kampioen Zotte Opdrachten', waarom: '5 opdrachten gedaan', earned: (s) => s.tasks >= 5 },
  { id: 'succes', naam: 'Held van Scheetegem', waarom: '15 worpen gelukt', earned: (s) => s.successes >= 15 },
  { id: 'perfect', naam: 'Ridder van de Perfecte Afloop', waarom: '2 beslissende momenten perfect', earned: (s) => s.perfects >= 2 },
  { id: 'vinder', naam: 'Verzamelaar van Rommel', waarom: '4 dingen gevonden', earned: (s) => s.finds >= 4 },
];
