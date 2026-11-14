// Wat er nu gespeeld wordt (seizoenshoofdstuk of los avontuur), met de teksten van de huidige scène.

import { activePlay, type Game } from '../game/state';
import type { SceneState } from '../game/season';
import { adventureView } from './adventure-view';
import { chapterView, type SceneView } from './season-view';

export interface CurrentPlay {
  state: SceneState;
  scenes: SceneView[];
}

export function currentPlay(game: Game): CurrentPlay | null {
  const state = activePlay(game);
  if (!state) return null;
  if (game.sessionMode === 'los' && game.adventure) return { state, scenes: adventureView(game.adventure).scenes };
  if (game.season) return { state, scenes: chapterView(game.season).scenes };
  return null;
}
