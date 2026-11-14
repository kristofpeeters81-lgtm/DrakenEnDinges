// Dobbelvenster: kies goed in / gewoon / slecht in, moeilijkheid en hulp; rol in de app of geef een echte worp in.
// Mislukt? Dan kan de held een frietje opeten om opnieuw te rollen.

import { requireGame, type App } from '../app';
import { diceNeeded, heroDiceCount, resolveRoll, rollDice, targetFor, type Difficulty, type Edge, type RollOutcome, type RollSetup } from '../game/dice';
import { canRoll, currentHero, eatFry, findHero, markRolled, nextTurn, presentHeroes, recordSuccessForLead, type Hero } from '../game/state';
import { actionOf, DICE_ICON, dieSvg, escapeHtml, FRY_BAG_SVG, $ } from '../ui/dom';
import { toast } from '../ui/dialog';

type Mode = 'setup' | 'enter' | 'rolling' | 'result';

/** Groepsworp (beslissend moment, finale): geen beurtslot, geen helper; het resultaat gaat naar `onResult`. */
export interface GroupRoll {
  title: string;
  onResult: (success: boolean) => void;
}

interface DiceState {
  heroId: string;
  edge: Edge;
  difficulty: Difficulty;
  helperId: string | null;
  mode: Mode;
  entered: number[];
  shown: number[];
  outcome: RollOutcome | null;
  /** Hoe er gerold werd, zodat "opnieuw" op dezelfde manier gaat. */
  source: 'app' | 'echt';
  group: GroupRoll | null;
}

function setupOf(s: DiceState): RollSetup {
  return { edge: s.edge, difficulty: s.difficulty, helped: s.helperId !== null };
}

function seg(name: string, value: string, label: string, active: boolean, extra = ''): string {
  return `<button class="seg ${active ? 'active' : ''}" data-action="${name}" data-id="${value}" aria-pressed="${active}">${label}${extra}</button>`;
}

function diceRow(s: DiceState, hero: Hero, helper: Hero | null, values: number[], kept: number | null): string {
  const heroCount = heroDiceCount(s.edge);
  return `<div class="dice-row">${values
    .map((v, i) => {
      const owner = i < heroCount ? hero.name : helper?.name ?? '';
      const cls = kept === null ? '' : i === kept ? 'kept' : 'dropped';
      return `<figure class="die-wrap ${cls}">${dieSvg(v)}<figcaption>${escapeHtml(owner)}${i >= heroCount ? ' (hulp)' : ''}</figcaption></figure>`;
    })
    .join('')}</div>`;
}

function explain(s: DiceState): string {
  const target = targetFor(s.difficulty);
  const how = s.edge === 'goed' ? '2 dobbelstenen, de hoogste telt' : s.edge === 'slecht' ? '2 dobbelstenen, de laagste telt' : '1 dobbelsteen';
  const help = s.helperId ? ' + 1 van de helper (hoogste telt)' : '';
  return `${how}${help} · nodig: <b>${target} of meer</b>`;
}

function render(app: App, s: DiceState): void {
  const game = requireGame(app);
  const overlay = $('#overlay');
  const hero = findHero(game, s.heroId);
  const helper = s.helperId ? findHero(game, s.helperId) : null;
  const others = presentHeroes(game).filter((h) => h.id !== hero.id);
  const n = diceNeeded(setupOf(s));
  let body = '';

  if (s.mode === 'setup') {
    body = `
      <h2>${DICE_ICON} ${escapeHtml(s.group ? s.group.title : `${hero.name} probeert iets`)}</h2>
      <p class="q">Is ${escapeHtml(hero.name)} hier goed of slecht in?</p>
      <div class="segs">
        ${seg('edge', 'goed', '👍 Goed in', s.edge === 'goed', `<small>${escapeHtml(hero.goodAt.join(' · '))}</small>`)}
        ${seg('edge', 'gewoon', 'Gewoon', s.edge === 'gewoon')}
        ${seg('edge', 'slecht', '👎 Slecht in', s.edge === 'slecht', `<small>${escapeHtml(hero.badAt)}</small>`)}
      </div>
      <p class="q">Hoe moeilijk?</p>
      <div class="segs">
        ${seg('diff', 'gewoon', 'Gewoon', s.difficulty === 'gewoon', '<small>4 of meer</small>')}
        ${seg('diff', 'moeilijk', 'Héél moeilijk', s.difficulty === 'moeilijk', '<small>5 of meer</small>')}
      </div>
      ${
        others.length > 0 && !s.group
          ? `<p class="q">Helpt er iemand? <small>(mislukt het, dan hebt ge allebei pech)</small></p>
             <div class="segs wrap">
               ${seg('helper', '', 'Niemand', s.helperId === null)}
               ${others.map((o) => seg('helper', o.id, escapeHtml(o.name), s.helperId === o.id)).join('')}
             </div>`
          : ''
      }
      <p class="explain">${explain(s)}</p>
      <div class="dice-actions">
        <button class="btn big primary" data-action="app-roll">${DICE_ICON} Rol in de app</button>
        <button class="btn big" data-action="real">Ik rol echt (${n} ${n === 1 ? 'dobbelsteen' : 'dobbelstenen'})</button>
      </div>`;
  } else if (s.mode === 'enter') {
    const values = [...s.entered];
    while (values.length < n) values.push(0);
    const next = s.entered.length < heroDiceCount(s.edge) ? hero.name : helper?.name ?? '';
    body = `
      <h2>Wat hebt ge gerold?</h2>
      <p class="explain">${explain(s)}</p>
      ${diceRow(s, hero, helper, values, null)}
      <p class="q">Tik de worp van <b>${escapeHtml(next)}</b>:</p>
      <div class="pad">${[1, 2, 3, 4, 5, 6].map((v) => `<button class="pad-btn" data-action="pip" data-id="${v}">${dieSvg(v)}</button>`).join('')}</div>
      <div class="dice-actions">
        <button class="btn" data-action="clear" ${s.entered.length === 0 ? 'disabled' : ''}>Wissen</button>
        <button class="btn ghost" data-action="to-setup">‹ Terug</button>
      </div>`;
  } else if (s.mode === 'rolling') {
    body = `
      <h2>${escapeHtml(hero.name)} rolt…</h2>
      <p class="explain">${explain(s)}</p>
      <div class="rolling">${diceRow(s, hero, helper, s.shown, null)}</div>`;
  } else if (s.outcome) {
    const o = s.outcome;
    const canRetry = !o.success && hero.fries > 0;
    const pech = o.success
      ? ''
      : helper
        ? `<p class="pech">Allebei pech! ${escapeHtml(hero.name)} én ${escapeHtml(helper.name)} — kijk bij <b>Zotte pech</b> op de regelkaart.</p>`
        : '<p class="pech">Oei. Misschien krijgt ge een <b>zotte pech</b> (regelkaart, achterkant).</p>';
    body = `
      <p class="explain">${explain(s)}</p>
      ${diceRow(s, hero, helper, o.dice, o.keptIndex)}
      <p class="verdict ${o.success ? 'ok' : 'nok'}">${o.success ? 'GELUKT!' : 'MISLUKT…'}</p>
      ${pech}
      <div class="dice-actions">
        ${
          canRetry
            ? `<button class="btn big fry-btn" data-action="retry">${FRY_BAG_SVG} Frietje opeten en opnieuw<small>nog ${hero.fries} ${hero.fries === 1 ? 'frietje' : 'frietjes'}</small></button>`
            : !o.success
              ? '<p class="hint">Geen frietjes meer… Verdien er eentje met een opdracht!</p>'
              : ''
        }
        <button class="btn big ${canRetry ? '' : 'primary'}" data-action="close">Klaar</button>
      </div>`;
  }

  overlay.innerHTML = `<div class="dice-panel mode-${s.mode}" role="dialog" aria-modal="true">
    <button class="btn ghost close-x" data-action="close" aria-label="Sluiten">✕</button>${body}</div>`;
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function finish(app: App, s: DiceState, dice: number[]): void {
  s.outcome = resolveRoll(setupOf(s), dice);
  s.mode = 'result';
  // Slot meteen zetten (niet pas bij sluiten): zo helpt venster sluiten of de pagina verversen niet om opnieuw te rollen.
  if (!s.group) {
    const game = requireGame(app);
    markRolled(game, s.heroId);
    if (s.outcome.success && recordSuccessForLead(game)) toast('Voorsprong! ★ Dat helpt straks bij het beslissende moment.');
  }
  app.changed();
  render(app, s);
}

function appRoll(app: App, s: DiceState): void {
  const n = diceNeeded(setupOf(s));
  const final = rollDice(n);
  s.source = 'app';
  if (reducedMotion()) {
    finish(app, s, final);
    return;
  }
  s.mode = 'rolling';
  let ticks = 0;
  const timer = window.setInterval(() => {
    ticks += 1;
    if (ticks >= 9) {
      window.clearInterval(timer);
      finish(app, s, final);
      return;
    }
    s.shown = rollDice(n);
    render(app, s);
  }, 75);
  s.shown = rollDice(n);
  render(app, s);
}

export function openDice(app: App, heroId: string, group: GroupRoll | null = null): void {
  const game = requireGame(app);
  const overlay = $('#overlay');
  if (!group && !canRoll(game, heroId)) {
    toast(`${findHero(game, heroId).name} heeft al gerold. Wacht tot ge terug aan de beurt zijt!`);
    return;
  }
  // Enkel wie aan de beurt is geeft na zijn worp de beurt door; een uitzonderlijke worp van iemand anders niet.
  const wasTurn = !group && currentHero(game)?.id === heroId;
  const s: DiceState = { heroId, edge: 'gewoon', difficulty: 'gewoon', helperId: null, mode: 'setup', entered: [], shown: [], outcome: null, source: 'app', group };

  const close = (): void => {
    overlay.hidden = true;
    overlay.innerHTML = '';
    overlay.onclick = null;
    if (s.outcome !== null && group) group.onResult(s.outcome.success);
    if (s.outcome !== null && wasTurn) {
      nextTurn(game);
      const next = currentHero(game);
      if (next && next.id !== heroId) toast(`Nu is ${next.name} aan de beurt!`);
    }
    app.changed();
  };

  overlay.onclick = (e) => {
    if (s.mode === 'rolling') return;
    const hit = actionOf(e);
    if (!hit) return;
    switch (hit.action) {
      case 'edge':
        s.edge = hit.id as Edge;
        break;
      case 'diff':
        s.difficulty = hit.id as Difficulty;
        break;
      case 'helper':
        s.helperId = hit.id || null;
        break;
      case 'app-roll':
        appRoll(app, s);
        return;
      case 'real':
        s.source = 'echt';
        s.entered = [];
        s.mode = 'enter';
        break;
      case 'pip':
        s.entered.push(Number(hit.id));
        if (s.entered.length === diceNeeded(setupOf(s))) {
          finish(app, s, s.entered);
          return;
        }
        break;
      case 'clear':
        s.entered = [];
        break;
      case 'to-setup':
        s.mode = 'setup';
        break;
      case 'retry':
        if (!eatFry(game, s.heroId)) break;
        app.changed();
        if (s.source === 'app') {
          appRoll(app, s);
          return;
        }
        s.entered = [];
        s.mode = 'enter';
        break;
      case 'close':
        close();
        return;
    }
    render(app, s);
  };

  overlay.hidden = false;
  render(app, s);
}
