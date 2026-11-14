// Dobbelregels van Draken & Dinges (zie regelkaart, vak 3 en 4):
// - 1 dobbelsteen, 4+ = gelukt; héél moeilijk = 5+.
// - Goed in: 2 dobbelstenen, hoogste telt. Slecht in: 2, laagste telt.
// - Iemand helpt: die rolt 1 dobbelsteen mee, de hoogste van (held, helper) telt.

export type Edge = 'goed' | 'gewoon' | 'slecht';
export type Difficulty = 'gewoon' | 'moeilijk';

export interface RollSetup {
  edge: Edge;
  difficulty: Difficulty;
  helped: boolean;
}

export interface RollOutcome {
  /** Alle dobbelstenen: eerst die van de held, de laatste is die van de helper (als er een helper is). */
  dice: number[];
  /** Welke dobbelsteen telt (index in `dice`). */
  keptIndex: number;
  kept: number;
  target: number;
  success: boolean;
}

export function heroDiceCount(edge: Edge): number {
  return edge === 'gewoon' ? 1 : 2;
}

export function diceNeeded(setup: RollSetup): number {
  return heroDiceCount(setup.edge) + (setup.helped ? 1 : 0);
}

export function targetFor(difficulty: Difficulty): number {
  return difficulty === 'moeilijk' ? 5 : 4;
}

function isDie(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 6;
}

export function resolveRoll(setup: RollSetup, dice: readonly number[]): RollOutcome {
  if (dice.length !== diceNeeded(setup)) throw new Error(`Verwacht ${diceNeeded(setup)} dobbelstenen, kreeg er ${dice.length}`);
  if (!dice.every(isDie)) throw new Error('Een dobbelsteen moet tussen 1 en 6 liggen');

  const heroCount = heroDiceCount(setup.edge);
  let keptIndex = 0;
  for (let i = 1; i < heroCount; i++) {
    const better = setup.edge === 'goed' ? dice[i] > dice[keptIndex] : dice[i] < dice[keptIndex];
    if (better) keptIndex = i;
  }
  if (setup.helped && dice[heroCount] > dice[keptIndex]) keptIndex = heroCount;

  const kept = dice[keptIndex];
  const target = targetFor(setup.difficulty);
  return { dice: [...dice], keptIndex, kept, target, success: kept >= target };
}

export function rollDice(count: number, rng: () => number = Math.random): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i++) out.push(1 + Math.floor(rng() * 6));
  return out;
}
