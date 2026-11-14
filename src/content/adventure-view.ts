// Losse avonturen (verborgen inhoud): één avond als mini-hoofdstuk met dezelfde vorm als een seizoenshoofdstuk.
// Geen plaatshouders: elk avontuur noemt zijn eigen plaatsen en figuren.

import type { Adventure } from '../game/adventure';
import { decodeContent } from './codec';
import { isBranch, isRecord, isScene, isStr, type Scene } from './season-content';
import { sceneView, type SceneView } from './season-view';
import { DATA as AVONTUREN } from './avonturen.data';

export interface AdventureContent {
  titel: string;
  intro: string;
  doel: string;
  begin: Scene;
  wending: { gelukt: Scene; mislukt: Scene };
  moment: { gelukt: string; mislukt: string };
  gelukt: string;
  mislukt: string;
}

function isAdventureList(v: unknown): v is AdventureContent[] {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every(
      (a) =>
        isRecord(a) &&
        ['titel', 'intro', 'doel', 'gelukt', 'mislukt'].every((k) => isStr(a[k])) &&
        isScene(a.begin) &&
        isBranch(a.wending, isScene) &&
        isBranch(a.moment, isStr),
    )
  );
}

let all: AdventureContent[] | null = null;

function adventures(): AdventureContent[] {
  if (!all) all = decodeContent(AVONTUREN, isAdventureList);
  return all;
}

export function adventureCount(): number {
  return adventures().length;
}

/** true zolang het echte verhaal er nog niet is (testinhoud heeft "(Test" in de titel). */
export function isTestAdventures(): boolean {
  return adventures().some((a) => a.titel.startsWith('(Test'));
}

function content(adv: Adventure): AdventureContent {
  const c = adventures()[adv.index];
  if (!c) throw new Error('Dit avontuur bestaat niet (meer) in de verhaalinhoud');
  return c;
}

export interface AdventureView {
  titel: string;
  intro: string;
  doel: string;
  scenes: SceneView[];
  moment: string | null;
}

export function adventureView(adv: Adventure): AdventureView {
  const c = content(adv);
  return {
    titel: c.titel,
    intro: c.intro,
    doel: c.doel,
    scenes: [sceneView(c.begin, {}), ...(adv.keys.length >= 1 ? [sceneView(adv.keys[0] ? c.wending.gelukt : c.wending.mislukt, {})] : [])],
    moment: adv.keys.length >= 2 ? (adv.keys[1] ? c.moment.gelukt : c.moment.mislukt) : null,
  };
}

export function adventureOutcome(adv: Adventure, success: boolean): string {
  const c = content(adv);
  return success ? c.gelukt : c.mislukt;
}
