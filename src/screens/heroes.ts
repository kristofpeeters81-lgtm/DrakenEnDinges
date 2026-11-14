// Heldenscherm: wie speelt er mee vandaag, helden aanmaken/aanpassen/verwijderen, sessie starten.

import { requireGame, saveButton, topbar, type App } from '../app';
import { openingCount } from '../content';
import { isTestContent, seasonCounts } from '../content/season-view';
import { CHAPTERS } from '../game/season';
import {
  beginLooseSession,
  beginSeasonSession,
  chooseOpening,
  hasUnsavedChanges,
  MAX_HEROES,
  presentHeroes,
  removeHero,
  setPresent,
  startSession,
  type Game,
  type Hero,
  type SessionMode,
} from '../game/state';
import { actionOf, escapeHtml } from '../ui/dom';
import { ask, confirmDialog, toast } from '../ui/dialog';
import { resetSeasonUi } from './season';

/** Vraagt wat er vandaag gespeeld wordt: verder in het seizoen (of een nieuw) of een los avontuur. */
async function chooseSessionKind(game: Game): Promise<SessionMode | null> {
  const s = game.season;
  let label = 'Nieuw seizoen';
  if (s && !s.finished) {
    const ch = s.momentDone ? s.chapter + 1 : s.chapter;
    label = ch >= CHAPTERS ? 'Verder: de finale!' : `Verder: hoofdstuk ${ch + 1}`;
  }
  const choice = await ask('Wat spelen jullie vandaag?', [
    { label: 'Annuleer', value: 'cancel' },
    { label: 'Los avontuur (beginscène)', value: 'los' },
    { label: isTestContent() ? `${label} (testverhaal)` : label, value: 'seizoen', primary: true },
  ]);
  return choice === 'seizoen' || choice === 'los' ? choice : null;
}

function heroCard(hero: Hero): string {
  return `
    <article class="card hero-card ${hero.present ? '' : 'absent'}">
      <h2>${escapeHtml(hero.name)}</h2>
      <p class="player">${hero.player ? `gespeeld door ${escapeHtml(hero.player)}` : '&nbsp;'}</p>
      <p class="kind">${escapeHtml(hero.kind)}</p>
      <label class="switch">
        <input type="checkbox" data-change="present" data-id="${hero.id}" ${hero.present ? 'checked' : ''} />
        <span class="track"><span class="knob"></span></span>
        <span class="switch-label">${hero.present ? 'Speelt mee vandaag' : 'Speelt niet mee'}</span>
      </label>
      <div class="card-actions">
        <button class="btn small" data-action="edit" data-id="${hero.id}">Aanpassen</button>
        <button class="btn small ghost" data-action="remove" data-id="${hero.id}">Weg</button>
      </div>
    </article>`;
}

export function renderHeroes(app: App): void {
  const game = requireGame(app);
  const present = presentHeroes(game).length;
  const full = game.heroes.length >= MAX_HEROES;
  const startLabel = game.sessionActive ? `Terug naar sessie ${game.session}` : `Start sessie ${game.session + 1}`;

  app.root.innerHTML = `
    <section class="screen heroes">
      ${topbar('Uw helden', { action: 'menu', label: 'Menu' }, saveButton(hasUnsavedChanges(game)))}
      ${game.heroes.length === 0 ? '<p class="intro">Nog geen helden. Maak er eentje per speler — maximum 6.</p>' : ''}
      <div class="card-grid">
        ${game.heroes.map(heroCard).join('')}
        ${
          full
            ? ''
            : `<button class="card add-card" data-action="add"><span class="plus">+</span>Nieuwe held<small>${game.heroes.length}/${MAX_HEROES}</small></button>`
        }
      </div>
      <footer class="screen-footer">
        <button class="btn big primary" data-action="start" ${present === 0 ? 'disabled' : ''}>${startLabel} ▶</button>
        <p class="hint">${present === 0 ? 'Zet minstens 1 held op “speelt mee”.' : `${present} ${present === 1 ? 'held speelt' : 'helden spelen'} mee.`}</p>
      </footer>
    </section>`;

  app.root.oninput = null;
  app.root.onchange = (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || target.dataset.change !== 'present') return;
    try {
      setPresent(game, target.dataset.id ?? '', target.checked);
      app.changed();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Oei, er ging iets mis.', 'error');
      app.changed();
    }
  };
  app.root.onclick = async (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    try {
      switch (hit.action) {
        case 'menu':
          app.go({ name: 'home' });
          break;
        case 'save':
          await app.saveToFile();
          break;
        case 'add':
          app.go({ name: 'editor', heroId: null });
          break;
        case 'edit':
          app.go({ name: 'editor', heroId: hit.id });
          break;
        case 'remove': {
          const hero = game.heroes.find((h) => h.id === hit.id);
          if (!hero) return;
          if (!(await confirmDialog(`${hero.name} echt weggooien? Alles van deze held is dan weg.`, 'Ja, weg', 'Nee'))) return;
          removeHero(game, hero.id);
          app.changed();
          break;
        }
        case 'start':
          if (!game.sessionActive) {
            const kind = await chooseSessionKind(game);
            if (!kind) return;
            startSession(game);
            resetSeasonUi();
            if (kind === 'seizoen') {
              beginSeasonSession(game, seasonCounts());
            } else {
              beginLooseSession(game);
              chooseOpening(game, openingCount());
            }
          }
          app.changed();
          app.go({ name: 'table' });
          break;
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Oei, er ging iets mis.', 'error');
    }
  };
}
