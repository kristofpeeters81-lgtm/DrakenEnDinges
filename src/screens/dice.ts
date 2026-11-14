// Dobbelvenster: kies goed in / gewoon / slecht in, moeilijkheid en hulp; rol in de app of geef een echte worp in.
// Mislukt? Dan kan de held een frietje opeten om opnieuw te rollen.

import { requireGame, type App } from '../app';
import { diceNeeded, heroDiceCount, resolveRoll, rollDice, targetFor, type Difficulty, type Edge, type RollOutcome, type RollSetup } from '../game/dice';
import { canRoll, canUseBuddy, currentHero, eatFry, findHero, itemUsable, markRolled, nextTurn, presentHeroes, recordRollStat, setPech, useBuddy, useItem, type Hero } from '../game/state';
import { itemUses } from '../game/growth';
import { getItem } from '../content';
import { isPechRoll, PECH, pickOther } from '../data/pech-opdrachten';
import { actionOf, DICE_ICON, dieSvg, escapeHtml, FRY_BAG_SVG, $ } from '../ui/dom';
import { toast } from '../ui/dialog';

type Mode = 'setup' | 'enter' | 'rolling' | 'result';

/** Het maatje van de held kan ook helpen (zoveel keer per sessie als zijn stadium). */
const BUDDY = 'maatje';

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
  /** Gekozen voorwerp uit de rugzak (index), of null. */
  itemSlot: number | null;
  itemSpent: boolean;
  buddySpent: boolean;
  /** Uitslag van de pech-dobbelsteen na een mislukte worp. */
  pech: { die: number; text: string | null } | null;
}

function setupOf(s: DiceState): RollSetup {
  return { edge: s.edge, difficulty: s.difficulty, helped: s.helperId !== null };
}

function seg(name: string, value: string, label: string, active: boolean, extra = ''): string {
  return `<button class="seg ${active ? 'active' : ''}" data-action="${name}" data-id="${value}" aria-pressed="${active}">${label}${extra}</button>`;
}

function diceRow(s: DiceState, hero: Hero, helper: { name: string } | null, values: number[], kept: number | null): string {
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
  const helper: { name: string } | null =
    s.helperId === BUDDY ? { name: hero.buddy?.name ?? 'Maatje' } : s.helperId ? findHero(game, s.helperId) : null;
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
      ${itemChoice(hero, s)}
      <p class="q">Hoe moeilijk?</p>
      <div class="segs">
        ${seg('diff', 'gewoon', 'Gewoon', s.difficulty === 'gewoon', '<small>4 of meer</small>')}
        ${seg('diff', 'moeilijk', 'Héél moeilijk', s.difficulty === 'moeilijk', '<small>5 of meer</small>')}
      </div>
      ${
        (others.length > 0 || canUseBuddy(hero)) && !s.group
          ? `<p class="q">Helpt er iemand? <small>(mislukt het, dan hebt ge allebei pech)</small></p>
             <div class="segs wrap">
               ${seg('helper', '', 'Niemand', s.helperId === null)}
               ${others.map((o) => seg('helper', o.id, escapeHtml(o.name), s.helperId === o.id)).join('')}
               ${canUseBuddy(hero) && hero.buddy ? seg('helper', BUDDY, `🐾 ${escapeHtml(hero.buddy.name)}`, s.helperId === BUDDY, '<small>uw maatje</small>') : ''}
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
    const canRetry = !o.success && hero.fries > 0 && s.pech === null;
    let pech = '';
    if (!o.success && !s.group) {
      if (s.pech === null) {
        pech = `<p class="pech">${helper ? `Allebei in gevaar: ${escapeHtml(hero.name)} én ${escapeHtml(helper.name)}!` : 'Oei…'}
          Probeer opnieuw met een frietje, of durf de pech-dobbelsteen: 1–3 = zotte pech, 4–6 = geluk gehad.</p>
          <button class="btn pech-btn" data-action="pech-roll">${DICE_ICON} Rol de pech-dobbelsteen</button>`;
      } else {
        pech = `<div class="pech-result">${dieSvg(s.pech.die)}${
          s.pech.text
            ? `<p><b>Zotte pech${helper ? ' voor allebei' : ''}!</b> ${escapeHtml(s.pech.text)} <small>(tot de volgende scène)</small></p>`
            : '<p><b>Geluk gehad!</b> Geen zotte pech deze keer.</p>'
        }</div>`;
      }
    }
    body = `
      <p class="explain">${explain(s)}</p>
      ${diceRow(s, hero, helper, o.dice, o.keptIndex)}
      <p class="verdict ${o.success ? 'ok' : 'nok'}">${o.success ? 'GELUKT!' : 'MISLUKT…'}</p>
      ${pech}
      <div class="dice-actions">
        ${
          canRetry
            ? `<button class="btn big fry-btn" data-action="retry">${FRY_BAG_SVG} Frietje opeten en opnieuw<small>nog ${hero.fries} ${hero.fries === 1 ? 'frietje' : 'frietjes'}</small></button>`
            : !o.success && hero.fries <= 0
              ? '<p class="hint">Geen frietjes meer… Verdien er eentje met een opdracht!</p>'
              : ''
        }
        <button class="btn big ${canRetry ? '' : 'primary'}" data-action="close">Klaar</button>
      </div>`;
  }

  overlay.innerHTML = `<div class="dice-panel mode-${s.mode}" role="dialog" aria-modal="true">
    <button class="btn ghost close-x" data-action="close" aria-label="Sluiten">✕</button>${body}</div>`;
}

/** Keuze om een voorwerp uit de rugzak te gebruiken (1× per sessie: telt als "goed in"). */
function itemChoice(hero: Hero, s: DiceState): string {
  const free = hero.items.map((it, slot) => ({ it, slot })).filter(({ it }) => itemUsable(it));
  if (free.length === 0) return '';
  const name = (item: number): string => getItem(item)?.naam ?? 'Voorwerp';
  return `<p class="q">Gebruikt ${escapeHtml(hero.name)} iets uit de rugzak? <small>(telt als “goed in”)</small></p>
    <div class="segs wrap">
      ${seg('item', '', 'Nee', s.itemSlot === null)}
      ${free.map(({ it, slot }) => seg('item', String(slot), `<span class="story-text">${escapeHtml(name(it.item))}</span>`, s.itemSlot === slot, `<small>nog ${itemUses(it.level) - it.usedCount}×</small>`)).join('')}
    </div>`;
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function finish(app: App, s: DiceState, dice: number[]): void {
  s.outcome = resolveRoll(setupOf(s), dice);
  s.mode = 'result';
  if (s.itemSlot !== null && !s.itemSpent) {
    useItem(requireGame(app), s.heroId, s.itemSlot);
    s.itemSpent = true;
  }
  if (s.helperId === BUDDY && !s.buddySpent) {
    useBuddy(requireGame(app), s.heroId);
    s.buddySpent = true;
  }
  recordRollStat(requireGame(app), s.heroId, s.outcome.success);
  // Slot meteen zetten (niet pas bij sluiten): zo helpt venster sluiten of de pagina verversen niet om opnieuw te rollen.
  if (!s.group) {
    const game = requireGame(app);
    markRolled(game, s.heroId);
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
  const s: DiceState = { heroId, edge: 'gewoon', difficulty: 'gewoon', helperId: null, mode: 'setup', entered: [], shown: [], outcome: null, source: 'app', group, itemSlot: null, itemSpent: false, buddySpent: false, pech: null };

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
      case 'item':
        s.itemSlot = hit.id === '' ? null : Number(hit.id);
        if (s.itemSlot !== null) s.edge = 'goed';
        break;
      case 'pech-roll': {
        if (s.pech !== null) break;
        const die = rollDice(1)[0];
        const hero = findHero(game, s.heroId);
        const text = isPechRoll(die) ? pickOther(PECH, hero.pech ?? '') : null;
        s.pech = { die, text };
        if (text) {
          setPech(game, s.heroId, text);
          if (s.helperId && s.helperId !== BUDDY) setPech(game, s.helperId, text);
        }
        app.changed();
        break;
      }
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
