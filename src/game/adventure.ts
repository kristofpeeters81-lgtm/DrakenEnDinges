// Los avontuur: één avond, gespeeld als een mini-hoofdstuk met dezelfde regels als een seizoenshoofdstuk
// (scènes met acties, vertakking, beslissend moment), maar zonder Slechterik-meter, aanwijzingen of finale.

import { MOMENT_SCENE, momentResult, type ChapterResult, type SceneState } from './season';

export interface Adventure extends SceneState {
  /** Nummer in de verborgen lijst met losse avonturen. */
  index: number;
  result: ChapterResult | null;
  /** De beloning (een voorwerp) na een gelukt beslissend moment is al gegeven. */
  rewardTaken: boolean;
}

export function newAdventure(index: number): Adventure {
  return { index, scene: 0, keys: [], log: [], momentDone: false, result: null, rewardTaken: false };
}

export function resolveAdventureMoment(adv: Adventure, diceSuccesses: number, rollers: number): ChapterResult {
  if (adv.momentDone) throw new Error('Het beslissende moment is al gespeeld');
  adv.scene = MOMENT_SCENE;
  adv.result = momentResult(adv, diceSuccesses, rollers, 0);
  adv.momentDone = true;
  return adv.result;
}
