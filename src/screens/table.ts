// Speeltafel: wie is aan de beurt, frietjes, kracht, en rollen. Het verhaal komt hier in blok 4–5.

import { requireGame, saveButton, topbar, type App } from '../app';
import {
  addFry,
  currentHero,
  eatFry,
  endSession,
  hasUnsavedChanges,
  MAX_FRIES,
  nextTurn,
  presentHeroes,
  setPowerUsed,
  type Hero,
} from '../game/state';
import { actionOf, BOLT_ICON, DICE_ICON, escapeHtml, FRY_BAG_SVG, frySvg, POT_SVG } from '../ui/dom';
import { ask, confirmDialog, toast } from '../ui/dialog';
import { openDice } from './dice';
import { openEidastinkt, openOracle, openPrikkel, oracleHistory } from './oracle';

function fries(hero: Hero): string {
  let icons = '';
  for (let i = 0; i < Math.max(hero.fries, 3); i++) icons += frySvg(i < hero.fries);
  return icons;
}

function oracleLog(): string {
  const items = oracleHistory();
  if (items.length === 0) return '';
  return `<ul class="oracle-history">${items
    .map((h) => `<li><span class="h-q">${h.question ? `“${escapeHtml(h.question)}”` : 'Vraag'}</span> <b class="${h.yes ? 'yes' : 'no'}">${escapeHtml(h.label)}</b></li>`)
    .join('')}</ul>`;
}

function heroCard(hero: Hero, isTurn: boolean): string {
  return `
    <article class="card table-card ${isTurn ? 'turn' : ''}">
      <div class="card-head">
        <h2>${escapeHtml(hero.name)}</h2>
        ${isTurn ? '<span class="badge">aan de beurt</span>' : ''}
      </div>
      <p class="kind">${escapeHtml(hero.kind)}${hero.player ? ` · <span class="player">${escapeHtml(hero.player)}</span>` : ''}</p>
      <ul class="chips">
        <li class="chip good">👍 ${escapeHtml(hero.goodAt[0])}</li>
        <li class="chip good">👍 ${escapeHtml(hero.goodAt[1])}</li>
        <li class="chip bad">👎 ${escapeHtml(hero.badAt)}</li>
      </ul>
      <div class="fries-row">
        <span class="fries-label">${FRY_BAG_SVG}<b>${hero.fries}</b></span>
        <span class="fries">${fries(hero)}</span>
        <span class="fry-buttons">
          <button class="btn icon small" data-action="eat" data-id="${hero.id}" ${hero.fries <= 0 ? 'disabled' : ''} title="Frietje opeten">−</button>
          <button class="btn icon small" data-action="fry" data-id="${hero.id}" ${hero.fries >= MAX_FRIES ? 'disabled' : ''} title="Frietje verdiend">+</button>
        </span>
      </div>
      <div class="power ${hero.powerUsed ? 'used' : ''}">
        ${BOLT_ICON}<span class="power-text">${escapeHtml(hero.power)}</span>
        <button class="btn small ${hero.powerUsed ? 'ghost' : ''}" data-action="power" data-id="${hero.id}">
          ${hero.powerUsed ? 'Gebruikt ✓' : 'Gebruiken'}
        </button>
      </div>
      ${
        hero.rolled
          ? '<button class="btn roll-small" disabled>Al gerold — wacht op uw beurt</button>'
          : `<button class="btn roll-small" data-action="roll" data-id="${hero.id}">${DICE_ICON} ${isTurn ? 'Rol' : 'Uitzonderlijk rollen'}</button>`
      }
    </article>`;
}

export function renderTable(app: App): void {
  const game = requireGame(app);
  if (!game.sessionActive || presentHeroes(game).length === 0) {
    app.go({ name: 'heroes' });
    return;
  }
  const current = currentHero(game);
  const present = presentHeroes(game);

  app.root.innerHTML = `
    <section class="screen table">
      ${topbar(
        `Sessie ${game.session}`,
        { action: 'heroes', label: 'Helden' },
        `${saveButton(hasUnsavedChanges(game))}<button class="btn ghost" data-action="stop">Stop sessie</button>`,
      )}
      ${
        current
          ? `<div class="turn-banner">
              <div><span class="turn-label">Aan de beurt</span><span class="turn-name">${escapeHtml(current.name)}</span></div>
              <button class="btn big primary" data-action="roll" data-id="${current.id}" ${current.rolled ? 'disabled' : ''}>${DICE_ICON} ${current.rolled ? 'Al gerold' : 'Rollen!'}</button>
              <button class="btn big" data-action="next" ${present.length < 2 ? 'disabled' : ''}>Volgende ▶</button>
            </div>`
          : ''
      }
      <section class="story-tools">
        <div class="story-pot">${POT_SVG}</div>
        <div class="story-main">
          <h2>Wat gebeurt er nu?</h2>
          <p>Vertel het samen. Weet niemand het? Vraag het aan de Pruttelpot.</p>
          <div class="story-buttons">
            <button class="btn big primary" data-action="oracle">Vraag de Pruttelpot</button>
            <button class="btn" data-action="prikkel">Zotte prikkel</button>
            <button class="btn eida" data-action="eida">Eidastinkt!</button>
          </div>
          ${oracleLog()}
        </div>
      </section>
      <div class="card-grid">${present.map((h) => heroCard(h, current?.id === h.id)).join('')}</div>
    </section>`;

  app.root.onchange = null;
  app.root.oninput = null;
  app.root.onclick = async (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    try {
      switch (hit.action) {
        case 'heroes':
          app.go({ name: 'heroes' });
          break;
        case 'save':
          await app.saveToFile();
          break;
        case 'next':
          nextTurn(game);
          app.changed();
          break;
        case 'roll':
          openDice(app, hit.id);
          break;
        case 'eat':
          eatFry(game, hit.id);
          app.changed();
          break;
        case 'fry':
          if (addFry(game, hit.id)) toast('Frietje verdiend! Smakelijk.');
          app.changed();
          break;
        case 'power': {
          const hero = present.find((h) => h.id === hit.id);
          if (!hero) return;
          setPowerUsed(game, hero.id, !hero.powerUsed);
          app.changed();
          break;
        }
        case 'stop':
          await stopSession(app);
          break;
        case 'oracle':
          openOracle(app);
          break;
        case 'prikkel':
          openPrikkel(app);
          break;
        case 'eida':
          openEidastinkt(app);
          break;
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Oei, er ging iets mis.', 'error');
    }
  };
}

async function stopSession(app: App): Promise<void> {
  const game = requireGame(app);
  if (!(await confirmDialog(`Sessie ${game.session} stoppen?`, 'Ja, stoppen', 'Nee, verder spelen'))) return;
  endSession(game);
  app.changed();
  if (hasUnsavedChanges(game)) {
    const choice = await ask('Vergeet niet te bewaren! Zo zijt ge uw helden nooit kwijt.', [
      { label: 'Later', value: 'later' },
      { label: 'Nu bewaren', value: 'save', primary: true },
    ]);
    if (choice === 'save') await app.saveToFile();
  }
  app.go({ name: 'heroes' });
}
