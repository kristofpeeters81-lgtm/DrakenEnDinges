// "Wat doet …?": wie aan de beurt is kiest een actie uit de lijst (of "iets anders…", via de Pruttelpot) en rolt.
// De uitkomst gaat in het verhaallogboek van het hoofdstuk en vult de voortgang van de scène.

import { requireGame, type App } from '../app';
import { chapterView } from '../content/season-view';
import { ANSWER_TEXTS, quipFor } from '../data/oracle-texts';
import { rollDice } from '../game/dice';
import { askOracle, isYes, oracleDiceCount, type Likelihood, type OracleOutcome } from '../game/oracle';
import { actionFailed, actionSucceeded, canAct, OWN_IDEA } from '../game/season';
import { currentHero, nextTurn, recordSceneAction, type Game, type Hero } from '../game/state';
import { toast } from '../ui/dialog';
import { actionOf, DICE_ICON, dieSvg, escapeHtml, POT_SVG, $ } from '../ui/dom';
import { openDice } from './dice';

function closeOverlay(app: App): void {
  const overlay = $('#overlay');
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.onclick = null;
  overlay.oninput = null;
  app.changed();
}

function announce(game: Game, outcome: boolean | null): void {
  if (outcome === true) toast('Scène gelukt! ★ Lees hoe het afloopt.');
  else if (outcome === false) toast('De beurten zijn op… Lees hoe het afloopt.');
  else {
    const next = currentHero(game);
    if (next) toast(`Nu is ${next.name} aan de beurt: wat doe je?`);
  }
}

/** Rolt voor een actie; daarna logboek, voortgang en beurt door (het dobbelvenster geeft de beurt door). */
function rollFor(app: App, hero: Hero, title: string, action: number, text: string): void {
  const game = requireGame(app);
  openDice(app, hero.id, null, {
    title,
    after: (success) => {
      const outcome = recordSceneAction(game, hero.name, action, text, success);
      // De beurt gaat pas daarna door (in het dobbelvenster); de melding gaat dus over wie er nu volgt.
      window.setTimeout(() => announce(game, outcome), 0);
    },
  });
}

export function openActions(app: App): void {
  const game = requireGame(app);
  const season = game.season;
  const hero = currentHero(game);
  if (!season || !hero || !canAct(season)) return;
  const scene = chapterView(season).scenes[season.scene];
  const overlay = $('#overlay');

  overlay.innerHTML = `<div class="dice-panel actions-panel" role="dialog" aria-modal="true">
    <button class="btn ghost close-x" data-action="close" aria-label="Sluiten">✕</button>
    <h2>Wat doet ${escapeHtml(hero.name)}?</h2>
    <p class="explain">Doel: <span class="story-text">${escapeHtml(scene.doel)}</span></p>
    <div class="action-list">${scene.acties
      .map((a, i) => {
        const done = actionSucceeded(season, i);
        const failed = actionFailed(season, i);
        return `<button class="action-btn ${done ? 'done' : ''}" data-action="pick" data-id="${i}" ${done ? 'disabled' : ''}>
          <span class="story-text">${escapeHtml(a.label)}</span>
          <small class="story-text">past bij: ${escapeHtml(a.past)}</small>
          ${done ? '<span class="tag ok">✓ gelukt</span>' : failed ? '<span class="tag again">nog eens proberen</span>' : ''}
        </button>`;
      })
      .join('')}
      <button class="action-btn own" data-action="own"><span>Iets anders…</span><small>Verzin zelf iets; de Pruttelpot zegt of het kan</small></button>
    </div>
    <p class="hint">Is ${escapeHtml(hero.name)} goed in wat de actie vraagt? Kies dan “goed in” in het dobbelvenster. Iemand mag helpen.</p>
  </div>`;
  overlay.hidden = false;
  overlay.oninput = null;
  overlay.onclick = (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    if (hit.action === 'close') closeOverlay(app);
    else if (hit.action === 'own') openOwnIdea(app, hero);
    else if (hit.action === 'pick') {
      const i = Number(hit.id);
      const a = scene.acties[i];
      if (!a || actionSucceeded(season, i)) return;
      overlay.onclick = null;
      rollFor(app, hero, a.label, i, '');
    }
  };
}

/** Iets anders: typen wat je doet, de Pruttelpot zegt of het kan, en zo ja rolt de held. */
function openOwnIdea(app: App, hero: Hero): void {
  const game = requireGame(app);
  const overlay = $('#overlay');
  const s: { text: string; likelihood: Likelihood; outcome: OracleOutcome | null } = { text: '', likelihood: 'gewoon', outcome: null };

  const render = (): void => {
    const o = s.outcome;
    const seg = (v: Likelihood, label: string, sub: string): string =>
      `<button class="seg ${s.likelihood === v ? 'active' : ''}" data-action="likely" data-id="${v}" ${o ? 'disabled' : ''}>${label}<small>${sub}</small></button>`;
    overlay.innerHTML = `<div class="dice-panel actions-panel own-panel" role="dialog" aria-modal="true">
      <button class="btn ghost close-x" data-action="close" aria-label="Sluiten">✕</button>
      <div class="pot-head">${POT_SVG}<div><h2>Wat doet ${escapeHtml(hero.name)}?</h2><p class="explain">Vertel het, en typ het kort (dan onthoudt de app het).</p></div></div>
      <label class="field oracle-q"><span class="field-label">${escapeHtml(hero.name)} …</span>
        <input type="text" data-field="own" maxlength="120" value="${escapeHtml(s.text)}" placeholder="bv. bakt een taart om de wachter om te kopen" ${o ? 'disabled' : ''} /></label>
      <p class="q">Kan dat hier? Hoe waarschijnlijk is het?</p>
      <div class="segs">${seg('waarschijnlijk', 'Waarschijnlijk', 'eerder ja')}${seg('gewoon', 'Geen idee', '50/50')}${seg('onwaarschijnlijk', 'Onwaarschijnlijk', 'eerder nee')}</div>
      ${
        o
          ? `<div class="dice-row">${o.dice.map((d, i) => `<figure class="die-wrap ${i === o.keptIndex ? 'kept' : 'dropped'}">${dieSvg(d)}</figure>`).join('')}</div>
             <p class="answer ${isYes(o.answer) ? 'yes' : 'no'}">${escapeHtml(ANSWER_TEXTS[o.answer].label)}</p>
             <p class="quip">${escapeHtml(quipFor(o.answer))}</p>
             <div class="dice-actions">${
               isYes(o.answer)
                 ? `<button class="btn big primary" data-action="own-roll">${DICE_ICON} Het kan! ${escapeHtml(hero.name)} rolt</button>`
                 : '<button class="btn big" data-action="own-no">Jammer… de beurt is voorbij</button>'
             }</div>`
          : `<div class="dice-actions"><button class="btn big primary" data-action="ask" ${s.text.trim() ? '' : 'disabled'}>Vraag de Pruttelpot</button></div>`
      }
    </div>`;
  };

  overlay.oninput = (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement) || t.dataset.field !== 'own') return;
    s.text = t.value;
    const ask = overlay.querySelector<HTMLButtonElement>('[data-action="ask"]');
    if (ask) ask.disabled = s.text.trim() === '';
  };
  overlay.onclick = (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    switch (hit.action) {
      case 'close':
        closeOverlay(app);
        return;
      case 'likely':
        s.likelihood = hit.id as Likelihood;
        break;
      case 'ask':
        if (!s.text.trim()) return;
        s.outcome = askOracle(s.likelihood, rollDice(oracleDiceCount(s.likelihood)));
        break;
      case 'own-roll':
        overlay.onclick = null;
        overlay.oninput = null;
        rollFor(app, hero, s.text.trim(), OWN_IDEA, s.text.trim());
        return;
      case 'own-no': {
        const outcome = recordSceneAction(game, hero.name, OWN_IDEA, s.text.trim(), false);
        nextTurn(game);
        closeOverlay(app);
        announce(game, outcome);
        return;
      }
    }
    render();
  };
  render();
  overlay.querySelector<HTMLInputElement>('input[data-field="own"]')?.focus();
}
