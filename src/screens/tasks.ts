// Opdrachten (een frietje verdienen) en vondsten (een voorwerp in de rugzak stoppen).

import { requireGame, type App } from '../app';
import { drawItem, getItem } from '../content';
import { OPDRACHTEN, pickOther } from '../data/pech-opdrachten';
import { findHero, giveItem, MAX_FRIES, MAX_ITEMS, ownedItems, presentHeroes, recordTask } from '../game/state';
import { ask, toast } from '../ui/dialog';
import { actionOf, escapeHtml, FRY_BAG_SVG, $ } from '../ui/dom';
import { readBar, readerOf } from '../ui/readaloud';

let lastTask = '';

function closeOverlay(app: App): void {
  const overlay = $('#overlay');
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.onclick = null;
  app.changed();
}

/** Een opdracht om een frietje te verdienen. Gedaan = +1 frietje. */
export function openTask(app: App, heroId: string): void {
  const game = requireGame(app);
  const hero = findHero(game, heroId);
  if (hero.fries >= MAX_FRIES) {
    toast(`${hero.name} heeft al een volle frietzak!`);
    return;
  }
  const overlay = $('#overlay');
  const render = (): void => {
    lastTask = pickOther(OPDRACHTEN, lastTask);
    overlay.innerHTML = `<div class="dice-panel task-panel" role="dialog" aria-modal="true">
      <button class="btn ghost close-x" data-action="close" aria-label="Sluiten">✕</button>
      <h2>${FRY_BAG_SVG} Opdracht voor ${escapeHtml(hero.name)}</h2>
      <p class="task-text">${escapeHtml(lastTask)}</p>
      <p class="explain">Doe het (of laat de speler het doen) en verdien een frietje.</p>
      <div class="dice-actions">
        <button class="btn big" data-action="other">Andere opdracht</button>
        <button class="btn big primary" data-action="done">Gedaan! Frietje erbij</button>
      </div>
    </div>`;
  };
  overlay.onclick = (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    if (hit.action === 'other') render();
    else if (hit.action === 'done') {
      if (recordTask(game, heroId)) toast(`Smakelijk, ${hero.name}! +1 frietje.`);
      closeOverlay(app);
    } else if (hit.action === 'close') closeOverlay(app);
  };
  overlay.hidden = false;
  render();
}

/** Iets gevonden: de app kiest een (verborgen) voorwerp, de spelers kiezen wie het in de rugzak stopt. */
export async function openFind(app: App, title = 'Jullie vinden iets!'): Promise<boolean> {
  const game = requireGame(app);
  const candidates = presentHeroes(game).filter((h) => h.items.length < MAX_ITEMS);
  if (candidates.length === 0) {
    toast('Alle rugzakken zitten vol!');
    return false;
  }
  const item = drawItem(ownedItems(game));
  const content = item === null ? null : getItem(item);
  if (item === null || !content) {
    toast('Er valt niets meer te vinden: jullie hebben alles al!');
    return false;
  }
  const overlay = $('#overlay');
  overlay.innerHTML = `<div class="dice-panel find-panel" role="dialog" aria-modal="true">
    <h2>${escapeHtml(title)}</h2>
    <p class="find-name story-text">${escapeHtml(content.naam)}</p>
    <p class="find-text story-text">${escapeHtml(content.beschrijving)}</p>
    ${readBar(`${content.naam}. ${content.beschrijving}`, readerOf(game))}
    <p class="explain">1× per sessie: een worp telt als “goed in”.</p>
  </div>`;
  overlay.hidden = false;
  overlay.onclick = null;
  const choice = await ask('Wie stopt het in de rugzak?', [
    ...candidates.map((h) => ({ label: h.name, value: h.id })),
  ]);
  const heroId = choice ?? candidates[0].id;
  giveItem(game, heroId, item);
  toast(`${findHero(game, heroId).name} stopt het in de rugzak.`);
  closeOverlay(app);
  return true;
}
