// Het orakel (de Pruttelpot): ja/nee-vragen beantwoorden met 1 dobbelsteen (zie regelkaart, vak 7).
// 1 Nee, en… · 2 Nee · 3 Nee, maar… · 4 Ja, maar… · 5 Ja · 6 Ja, en…
// Waarschijnlijk: 2 dobbelstenen, hoogste telt. Onwaarschijnlijk: 2 dobbelstenen, laagste telt.

export type Likelihood = 'waarschijnlijk' | 'gewoon' | 'onwaarschijnlijk';
export type Answer = 'nee-en' | 'nee' | 'nee-maar' | 'ja-maar' | 'ja' | 'ja-en';

/** Antwoord per worp: index 0 = worp 1. */
export const ANSWERS: readonly Answer[] = ['nee-en', 'nee', 'nee-maar', 'ja-maar', 'ja', 'ja-en'];

export interface OracleOutcome {
  dice: number[];
  keptIndex: number;
  answer: Answer;
}

export function oracleDiceCount(likelihood: Likelihood): number {
  return likelihood === 'gewoon' ? 1 : 2;
}

export function askOracle(likelihood: Likelihood, dice: readonly number[]): OracleOutcome {
  if (dice.length !== oracleDiceCount(likelihood)) throw new Error(`Verwacht ${oracleDiceCount(likelihood)} dobbelstenen`);
  if (!dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6)) throw new Error('Een dobbelsteen moet tussen 1 en 6 liggen');
  let keptIndex = 0;
  if (dice.length === 2) {
    const secondBetter = likelihood === 'waarschijnlijk' ? dice[1] > dice[0] : dice[1] < dice[0];
    keptIndex = secondBetter ? 1 : 0;
  }
  return { dice: [...dice], keptIndex, answer: ANSWERS[dice[keptIndex] - 1] };
}

export function isYes(answer: Answer): boolean {
  return answer.startsWith('ja');
}

/** "…en" en "…maar" vragen om iets extra te verzinnen: daar hoort een zotte prikkel bij. */
export function wantsPrompt(answer: Answer): boolean {
  return answer.endsWith('-en') || answer.endsWith('-maar');
}
