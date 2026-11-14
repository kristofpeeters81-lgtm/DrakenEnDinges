// Teksten van de Pruttelpot (het orakel) en de zotte prikkels. Geen spoilerinhoud: dit is decor.
// De eerste 6 woorden van elke prikkel-lijst staan ook op de regelkaart (print/regelkaart.html).

import type { Answer } from '../game/oracle';

export interface AnswerText {
  /** Groot op het scherm. */
  label: string;
  /** Wat het betekent, voor wie twijfelt. */
  meaning: string;
  /** Wat de pot erbij pruttelt (willekeurig één). */
  quips: readonly string[];
}

export const ANSWER_TEXTS: Record<Answer, AnswerText> = {
  'ja-en': {
    label: 'Ja, en zelfs nog beter!',
    meaning: 'Het is zo, én er komt iets goeds bij. Verzin samen wat.',
    quips: ['Amai! Da’s nog straffer dan ge dacht!', 'Ja! En de pot doet er nog een schepke bovenop.', 'Allez, ge hebt chance vandaag!'],
  },
  ja: {
    label: 'Ja.',
    meaning: 'Gewoon ja. Simpel.',
    quips: ['Ja. Klaar. Volgende vraag.', 'De pot zegt: ja zenne.', 'Ja. Niks meer aan te doen.'],
  },
  'ja-maar': {
    label: 'Ja, maar…',
    meaning: 'Het is zo, maar er is een addertje onder het gras. Verzin samen wat.',
    quips: ['Ja… maar ’t is niet zo simpel als ge denkt.', 'Ja, mààr… er is altijd een maar.', 'Ja, maar ’t riekt hier een beetje raar.'],
  },
  'nee-maar': {
    label: 'Nee, maar…',
    meaning: 'Het is niet zo, maar er is toch iets goeds of een andere weg. Verzin samen wat.',
    quips: ['Nee… maar treur niet, er is nog hoop.', 'Nee, maar ’t is niet allemaal kommer en kwel.', 'Nee. Maar wacht, de pot pruttelt nog iets…'],
  },
  nee: {
    label: 'Nee.',
    meaning: 'Gewoon nee. Pech.',
    quips: ['Nee. Ocharme.', 'De pot zegt: nee nee nee.', 'Nee. Zo simpel is ’t.'],
  },
  'nee-en': {
    label: 'Nee, en het is nog erger…',
    meaning: 'Het is niet zo, én er loopt nog iets mis. Verzin samen wat.',
    quips: ['Nee! En ’t wordt nog ambetanter…', 'Ei da stinkt… nee, en ’t is nog erger.', 'Oei oei oei. Nee. En ’t gaat van kwaad naar erger.'],
  },
};

export const PROMPT_ADJECTIVES = [
  'natte',
  'piepende',
  'stinkende',
  'gouden',
  'boze',
  'dansende',
  'plakkerige',
  'verliefde',
  'onzichtbare',
  'reuzegrote',
  'piepkleine',
  'slapende',
  'zingende',
  'betoverde',
  'ambetante',
  'verdwaalde',
  'verkouden',
  'harige',
  'vliegende',
  'deftige',
  'kriebelende',
  'knorrende',
  'glimmende',
  'beschimmelde',
  'scheve',
  'kletsnatte',
  'pruttelende',
  'opgeblazen',
  'wiebelende',
  'rammelende',
  'verlegen',
  'chique',
  'onhandige',
  'mysterieuze',
  'gestreepte',
  'bevroren',
  'gloeiende',
  'verdrietige',
  'giechelende',
  'snurkende',
] as const;

export const PROMPT_NOUNS = [
  'sok',
  'kip',
  'pollepel',
  'wc-rol',
  'nonkel',
  'pannenkoek',
  'speculoos',
  'frietzak',
  'regenjas',
  'kermiskaart',
  'duif',
  'kassei',
  'mattentaart',
  'fiets',
  'paraplu',
  'toverstaf',
  'mosselpot',
  'onderbroek',
  'trompet',
  'badeend',
  'wafel',
  'kermispaard',
  'frietkot',
  'schoolbel',
  'juf',
  'accordeon',
  'carnavalsmuts',
  'pantoffel',
  'nachtpot',
  'tuinkabouter',
  'stofzuiger',
  'hamster',
  'bompa',
  'regenton',
  'zeepbel',
  'spruitje',
  'muizenval',
  'ballon',
  'kroon',
  'trampoline',
] as const;

let lastPrikkel = '';

/** Twee woorden om iets zot mee te verzinnen, bv. "natte pollepel". Nooit twee keer na elkaar dezelfde. */
export function zottePrikkel(rng: () => number = Math.random): { adjective: string; noun: string } {
  for (let attempt = 0; ; attempt++) {
    const adjective = PROMPT_ADJECTIVES[Math.floor(rng() * PROMPT_ADJECTIVES.length)];
    const noun = PROMPT_NOUNS[Math.floor(rng() * PROMPT_NOUNS.length)];
    const key = `${adjective} ${noun}`;
    if (key !== lastPrikkel || attempt >= 5) {
      lastPrikkel = key;
      return { adjective, noun };
    }
  }
}

export function quipFor(answer: Answer, rng: () => number = Math.random): string {
  const quips = ANSWER_TEXTS[answer].quips;
  return quips[Math.floor(rng() * quips.length)];
}
