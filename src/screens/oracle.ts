// De Pruttelpot (orakel), zotte prikkels en Eidastinkt-voorvallen. Telt niet als worp: iedereen mag altijd vragen.

import type { App } from '../app';
import { drawEidastinkt } from '../content';
import { ANSWER_TEXTS, quipFor, zottePrikkel } from '../data/oracle-texts';
import { askOracle, isYes, oracleDiceCount, wantsPrompt, type Likelihood, type OracleOutcome } from '../game/oracle';
import { rollDice } from '../game/dice';
import { actionOf, dieSvg, escapeHtml, POT_SVG, $ } from '../ui/dom';

interface HistoryItem {
  question: string;
  label: string;
  yes: boolean;
}

const history: HistoryItem[] = [];

/** De laatste antwoorden van de pot (enkel voor deze speelavond, niet bewaard). */
export function oracleHistory(): readonly HistoryItem[] {
  return history;
}

type Mode = 'setup' | 'enter' | 'rolling' | 'result';

interface OracleState {
  question: string;
  likelihood: Likelihood;
  mode: Mode;
  entered: number[];
  shown: number[];
  outcome: OracleOutcome | null;
  quip: string;
  prikkel: string;
}

function seg(value: Likelihood, label: string, sub: string, active: boolean): string {
  return `<button class="seg ${active ? 'active' : ''}" data-action="likely" data-id="${value}" aria-pressed="${active}">${label}<small>${sub}</small></button>`;
}

function prikkelText(): string {
  const p = zottePrikkel();
  return `${p.adjective} ${p.noun}`;
}

function dice(values: number[], kept: number | null): string {
  return `<div class="dice-row">${values
    .map((v, i) => `<figure class="die-wrap ${kept === null ? '' : i === kept ? 'kept' : 'dropped'}">${dieSvg(v)}</figure>`)
    .join('')}</div>`;
}

function shell(body: string, extraClass = ''): string {
  return `<div class="dice-panel oracle-panel ${extraClass}" role="dialog" aria-modal="true">
    <button class="btn ghost close-x" data-action="close" aria-label="Sluiten">✕</button>${body}</div>`;
}

function renderOracle(s: OracleState): void {
  const overlay = $('#overlay');
  const n = oracleDiceCount(s.likelihood);
  const q = s.question.trim();
  let body = '';
  if (s.mode === 'setup') {
    body = `
      <div class="pot-head">${POT_SVG}<div><h2>De Pruttelpot</h2><p class="explain">Stel een ja/nee-vraag. De pot pruttelt het antwoord.</p></div></div>
      <label class="field oracle-q">
        <span class="field-label">Uw vraag <small style="display:inline">(mag ook gewoon hardop)</small></span>
        <input type="text" data-field="question" value="${escapeHtml(s.question)}" placeholder="bv. Is er een geheime deur?" maxlength="120" autocomplete="off" />
      </label>
      <p class="q">Hoe waarschijnlijk is het?</p>
      <div class="segs">
        ${seg('waarschijnlijk', 'Waarschijnlijk', 'eerder ja', s.likelihood === 'waarschijnlijk')}
        ${seg('gewoon', 'Geen idee', '50/50', s.likelihood === 'gewoon')}
        ${seg('onwaarschijnlijk', 'Onwaarschijnlijk', 'eerder nee', s.likelihood === 'onwaarschijnlijk')}
      </div>
      <div class="dice-actions">
        <button class="btn big primary" data-action="app-roll">Laat de pot pruttelen</button>
        <button class="btn big" data-action="real">Ik rol echt (${n} ${n === 1 ? 'dobbelsteen' : 'dobbelstenen'})</button>
      </div>`;
  } else if (s.mode === 'enter') {
    const values = [...s.entered];
    while (values.length < n) values.push(0);
    body = `
      <h2>Wat hebt ge gerold?</h2>
      ${q ? `<p class="question">“${escapeHtml(q)}”</p>` : ''}
      ${dice(values, null)}
      <div class="pad">${[1, 2, 3, 4, 5, 6].map((v) => `<button class="pad-btn" data-action="pip" data-id="${v}">${dieSvg(v)}</button>`).join('')}</div>
      <div class="dice-actions">
        <button class="btn" data-action="clear" ${s.entered.length === 0 ? 'disabled' : ''}>Wissen</button>
        <button class="btn ghost" data-action="to-setup">‹ Terug</button>
      </div>`;
  } else if (s.mode === 'rolling') {
    body = `
      <div class="pot-big bubbling">${POT_SVG}</div>
      <p class="explain">De pot pruttelt…</p>`;
  } else if (s.outcome) {
    const text = ANSWER_TEXTS[s.outcome.answer];
    body = `
      <div class="pot-big">${POT_SVG}</div>
      ${q ? `<p class="question">“${escapeHtml(q)}”</p>` : ''}
      <p class="answer ${isYes(s.outcome.answer) ? 'yes' : 'no'}">${escapeHtml(text.label)}</p>
      <p class="quip">${escapeHtml(s.quip)}</p>
      <p class="explain">${escapeHtml(text.meaning)}</p>
      ${s.prikkel ? `<p class="prikkel-inline">Zotte prikkel: <b>${escapeHtml(s.prikkel)}</b></p>` : ''}
      ${dice(s.outcome.dice, s.outcome.keptIndex)}
      <div class="dice-actions">
        <button class="btn big" data-action="again">Nog een vraag</button>
        <button class="btn big primary" data-action="close">Klaar</button>
      </div>`;
  }
  overlay.innerHTML = shell(body, `mode-${s.mode}`);
  if (s.mode === 'setup') overlay.querySelector<HTMLInputElement>('input[data-field="question"]')?.focus();
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function closeOverlay(app: App): void {
  const overlay = $('#overlay');
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlay.onclick = null;
  overlay.oninput = null;
  overlay.onkeydown = null;
  app.changed();
}

export function openOracle(app: App): void {
  const overlay = $('#overlay');
  const s: OracleState = { question: '', likelihood: 'gewoon', mode: 'setup', entered: [], shown: [], outcome: null, quip: '', prikkel: '' };

  const finish = (values: number[]): void => {
    const outcome = askOracle(s.likelihood, values);
    s.outcome = outcome;
    s.quip = quipFor(outcome.answer);
    s.prikkel = wantsPrompt(outcome.answer) ? prikkelText() : '';
    s.mode = 'result';
    history.unshift({ question: s.question.trim(), label: ANSWER_TEXTS[outcome.answer].label, yes: isYes(outcome.answer) });
    history.length = Math.min(history.length, 4);
    renderOracle(s);
  };

  const appRoll = (): void => {
    const values = rollDice(oracleDiceCount(s.likelihood));
    if (reducedMotion()) {
      finish(values);
      return;
    }
    s.mode = 'rolling';
    renderOracle(s);
    window.setTimeout(() => finish(values), 900);
  };

  overlay.oninput = (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.dataset.field === 'question') s.question = target.value;
  };
  overlay.onkeydown = (e) => {
    if (e.key === 'Enter' && s.mode === 'setup') appRoll();
  };
  overlay.onclick = (e) => {
    if (s.mode === 'rolling') return;
    const hit = actionOf(e);
    if (!hit) return;
    switch (hit.action) {
      case 'likely':
        s.likelihood = hit.id as Likelihood;
        break;
      case 'app-roll':
        appRoll();
        return;
      case 'real':
        s.entered = [];
        s.mode = 'enter';
        break;
      case 'pip':
        s.entered.push(Number(hit.id));
        if (s.entered.length === oracleDiceCount(s.likelihood)) {
          finish(s.entered);
          return;
        }
        break;
      case 'clear':
        s.entered = [];
        break;
      case 'to-setup':
        s.mode = 'setup';
        break;
      case 'again':
        Object.assign(s, { question: '', likelihood: 'gewoon', mode: 'setup', entered: [], outcome: null, quip: '', prikkel: '' });
        break;
      case 'close':
        closeOverlay(app);
        return;
    }
    renderOracle(s);
  };

  overlay.hidden = false;
  renderOracle(s);
}

export function openPrikkel(app: App): void {
  const overlay = $('#overlay');
  const render = (): void => {
    overlay.innerHTML = shell(`
      <h2>Zotte prikkel</h2>
      <p class="explain">Verzin iets met deze twee woorden. Hoe zotter, hoe beter!</p>
      <p class="prikkel-big">${escapeHtml(prikkelText())}</p>
      <div class="dice-actions">
        <button class="btn big" data-action="again">Nog eens</button>
        <button class="btn big primary" data-action="close">Klaar</button>
      </div>`);
  };
  overlay.onclick = (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    if (hit.action === 'again') render();
    else if (hit.action === 'close') closeOverlay(app);
  };
  overlay.hidden = false;
  render();
}

export function openEidastinkt(app: App): void {
  const overlay = $('#overlay');
  const render = (): void => {
    overlay.innerHTML = shell(
      `
      <p class="eida-shout">Eidastinkt!</p>
      <p class="eida-event">${escapeHtml(drawEidastinkt())}</p>
      <div class="dice-actions">
        <button class="btn big primary" data-action="close">Verder spelen</button>
      </div>`,
      'eida-panel',
    );
  };
  overlay.onclick = (e) => {
    const hit = actionOf(e);
    if (hit?.action === 'close') closeOverlay(app);
  };
  overlay.hidden = false;
  render();
}
