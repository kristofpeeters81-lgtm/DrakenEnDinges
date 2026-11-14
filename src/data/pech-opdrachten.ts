// Zotte pech en opdrachten (om een frietje te verdienen). Geen spoilerinhoud: de eerste 6 van elke lijst staan
// ook op de achterkant van de regelkaart (public/print/regelkaart.html) — samen aanpassen.

export const PECH = [
  'Uw haar wordt paars. En het blijft groeien.',
  'Ge moet rijmen. Alles. Elke zin.',
  'Ge zijt een kip. Ge moogt alleen nog “tok” zeggen.',
  'Ge hebt de hik. Bij elke zin. Hik!',
  'Uw broek zakt af. Op het slechtste moment.',
  'Ge praat zoals Lord Water Closet: héél deftig, met een Engels accent. Indeed.',
  'Ge moet alles fluisteren, alsof er een baby slaapt.',
  'Uw neus piept bij elke stap.',
  'Ge zijt zo plakkerig als een lolly: alles blijft aan u hangen.',
  'Ge kunt alleen nog achteruit stappen.',
  'Ge moet na elke zin “zenne” zeggen.',
  'Er volgt u een klein regenwolkje. Ge zijt kletsnat.',
] as const;

export const OPDRACHTEN = [
  'Doe 10 seconden een kip na. Met geluid.',
  'Zeg de wapenspreuk “Wie ’t riekt, heeft ’t gefliekt” met de stem van een verkouden trol.',
  'Sta op uw stoel en geef een speech als koning(in) van Kakofonië.',
  'Zing wat ge daarnet zei, als een opera.',
  'Doe de slechterik na. Met boze wenkbrauwen.',
  'De anderen kiezen een opdracht voor u. Oei.',
  'Dans 10 seconden de robotdans.',
  'Vertel een mop. Lacht er niemand? Dan nog eentje.',
  'Roep “Eidastinkt!” zo dramatisch als ge kunt.',
  'Doe alsof ge op een kermismolen zit die véél te snel draait.',
  'Praat een hele minuut zoals Lord Water Closet. Indeed.',
  'Geef iedereen aan tafel een compliment. In rijm.',
  'Doe een frietbakker na die een gigantische bestelling krijgt.',
  'Sta stil als een standbeeld tot er iemand lacht.',
  'Zeg het alfabet zo snel als ge kunt.',
  'Doe een draak na die moet niezen.',
  'De jongste speler kiest een stemmetje voor u. Praat zo tot uw volgende beurt.',
  'Doe een paard na dat de wals danst.',
  'Doe alsof ge een pannenkoek omdraait die aan het plafond blijft plakken.',
  'Brul als een leeuw. Miauw daarna als een piepklein katje.',
  'Wees 15 seconden een toverspiegel die alleen complimentjes geeft.',
  'Doe de juf na die zegt dat iedereen nu écht stil moet zijn.',
  'Vertel in één zin wat uw held het allerliefste eet.',
  'Maak het geluid van een wc die doortrekt.',
] as const;

/** 1–3 op de pech-dobbelsteen = zotte pech, 4–6 = geluk gehad. */
export function isPechRoll(die: number): boolean {
  return die <= 3;
}

/** Kiest willekeurig, maar nooit `avoid` (de vorige) als er iets anders is. */
export function pickOther(list: readonly string[], avoid: string, rng: () => number = Math.random): string {
  const options = list.filter((x) => x !== avoid);
  const pool = options.length > 0 ? options : list;
  return pool[Math.floor(rng() * pool.length)];
}
