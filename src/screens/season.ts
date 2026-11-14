// Speeltafel: een seizoenshoofdstuk of een los avontuur (zelfde kaart: scènes met doel, acties, voortgang en
// verhaallogboek, vertakking en beslissend moment), plus voor seizoenen de Slechterik-meter en de finale.
// De voortgang van een groepsworp zit enkel in het geheugen; pas de uitkomst wordt in het spel bewaard.

import { requireGame, type App } from '../app';
import { adventureOutcome, adventureView, isTestAdventures } from '../content/adventure-view';
import type { NamedThing } from '../content/season-content';
import {
  chapterView,
  clueTexts,
  finaleRoundText,
  finaleView,
  finaleWonText,
  isTestContent,
  momentText,
  villainName,
  type SceneView,
} from '../content/season-view';
import { rollDice } from '../game/dice';
import {
  CHAPTERS,
  hasAlly,
  isFinale,
  KEY_MOMENTS,
  keyDone,
  leadTotal,
  METER_MAX,
  MOMENT_SCENE,
  MOMENT_TARGET,
  neededSuccesses,
  OWN_IDEA,
  rollerCount,
  SCENE_GOAL,
  SCENE_TURNS,
  sceneProgress,
  SCENES,
  turnsLeft,
  type ChapterResult,
  type LogEntry,
  type SceneState,
  type Season,
} from '../game/season';
import { activePlay, currentHero, findHero, nextScene, presentHeroes, recordFinaleRound, recordMoment, takeReward, type Game } from '../game/state';
import { openActions } from './actions';
import { openFind } from './tasks';
import { readBar, readerOf } from '../ui/readaloud';
import { confirmDialog } from '../ui/dialog';
import { DICE_ICON, dieSvg, escapeHtml } from '../ui/dom';
import { openDice } from './dice';

interface GroupRound {
  /** Hoort bij dit spel/hoofdstuk/sessie; anders vergeten. */
  key: string;
  rolls: Record<string, boolean>;
  allyDie: number | null;
}

interface Aftermath {
  key: string;
  text: string;
  kind: 'moment' | 'finale-round' | 'won';
}

/** Alles wat de kaart nodig heeft om een seizoenshoofdstuk of een los avontuur te tonen. */
interface PlayContext {
  state: SceneState;
  label: string;
  titel: string;
  recap: string | null;
  intro: string | null;
  scenes: SceneView[];
  doel: string;
  plaats: NamedThing | null;
  figuur: NamedThing | null;
  moment: string | null;
  meter: number;
  result: ChapterResult | null;
  outcome: (success: boolean) => string;
  resultLabel: (r: ChapterResult) => string;
  doneHint: string;
  rewardTaken: boolean;
}

const SCENE_NAMES = ['Het begin', 'De wending', 'Het beslissende moment'];

let round: GroupRound | null = null;
let aftermath: Aftermath | null = null;
let finaleRounds = 0;

function keyOf(game: Game): string {
  const what =
    game.sessionMode === 'los' ? `los${game.adventure?.index ?? ''}` : `${game.season?.villain ?? ''}|${game.season?.chapter ?? ''}`;
  return `${game.id}|${what}|${game.session}`;
}

function currentRound(game: Game): GroupRound | null {
  return round && round.key === keyOf(game) ? round : null;
}

function currentAftermath(game: Game): Aftermath | null {
  return aftermath && aftermath.key === keyOf(game) ? aftermath : null;
}

function meter(season: Season): string {
  let segs = '';
  for (let i = 1; i <= METER_MAX; i++) segs += `<span class="seg-m ${i <= season.meter ? 'on' : ''}"></span>`;
  return `<div class="meter" title="Slechterik-meter ${season.meter}/${METER_MAX}">
    <span class="meter-label">Slechterik-meter</span><span class="meter-bar">${segs}</span><b>${season.meter}/${METER_MAX}</b></div>`;
}

function stars(n: number, max: number): string {
  let out = '';
  for (let i = 0; i < max; i++) out += `<span class="star ${i < n ? 'on' : ''}">★</span>`;
  return out;
}

/** Voorsprong: één ster per gelukte scène, plus een bonusster als ze allebei lukten. */
function lead(state: SceneState): string {
  if (state.momentDone) return '';
  let out = '';
  for (let i = 0; i < KEY_MOMENTS; i++) out += `<span class="star ${state.keys[i] === true ? 'on' : ''}">★</span>`;
  const bonus = state.keys.length === KEY_MOMENTS && state.keys.every(Boolean);
  return `<div class="lead" title="1 ster per gelukte scène, +1 als ze allebei lukken">Voorsprong ${out}<span class="star bonus ${bonus ? 'on' : ''}">★</span></div>`;
}

function hearts(season: Season): string {
  const total = season.heartsStart ?? 0;
  const left = season.hearts ?? 0;
  let out = '';
  for (let i = 0; i < total; i++) out += `<span class="heart ${i < left ? 'full' : 'lost'}">♥</span>`;
  return `<div class="hearts" aria-label="nog ${left} levens">${out}</div>`;
}

function rollersList(game: Game, r: GroupRound): string {
  const heroes = presentHeroes(game);
  const rows = heroes.map((h) => {
    const done = h.id in r.rolls;
    const status = done
      ? `<span class="roll-status ${r.rolls[h.id] ? 'ok' : 'nok'}">${r.rolls[h.id] ? '✓ gelukt' : '✗ mislukt'}</span>`
      : `<button class="btn small primary" data-action="group-roll" data-id="${h.id}">${DICE_ICON} Rol</button>`;
    return `<li><span class="roller-name">${escapeHtml(h.name)}</span>${status}</li>`;
  });
  if (hasAlly(heroes.length)) {
    const status =
      r.allyDie !== null
        ? `<span class="ally-die">${dieSvg(r.allyDie)}</span><span class="roll-status ${r.allyDie >= MOMENT_TARGET ? 'ok' : 'nok'}">${r.allyDie >= MOMENT_TARGET ? '✓ gelukt' : '✗ mislukt'}</span>`
        : `<button class="btn small" data-action="ally-roll">${DICE_ICON} Bondgenoot rolt</button>`;
    rows.push(`<li><span class="roller-name">Een bondgenoot <small style="display:inline">(helpt kleine groepen)</small></span>${status}</li>`);
  }
  return `<ul class="rollers">${rows.join('')}</ul>`;
}

function successes(game: Game, r: GroupRound): { done: boolean; count: number } {
  const heroes = presentHeroes(game);
  const all = heroes.every((h) => h.id in r.rolls) && (!hasAlly(heroes.length) || r.allyDie !== null);
  const count = heroes.filter((h) => r.rolls[h.id]).length + (r.allyDie !== null && r.allyDie >= MOMENT_TARGET ? 1 : 0);
  return { done: all, count };
}

/** Logboekregels van één scène, met het gevolg van elke actie. */
function logList(entries: LogEntry[], sc: SceneView): string {
  if (entries.length === 0) return '';
  return `<ol class="story-log">${entries
    .map((e) => {
      const a = e.action === OWN_IDEA ? null : sc.acties[e.action];
      const what = a ? `<span class="story-text">${escapeHtml(a.label)}</span>` : `eigen idee: <i>“${escapeHtml(e.text)}”</i>`;
      const result = a ? (e.success ? a.gelukt : a.mislukt) : e.success ? 'Het lukt!' : 'Het lukt niet…';
      return `<li class="${e.success ? 'ok' : 'nok'}"><b>${escapeHtml(e.hero)}</b> — ${what} <span class="mark">${e.success ? '✓' : '✗'}</span>
        <br><span class="${a ? 'story-text' : ''}">${escapeHtml(result)}</span></li>`;
    })
    .join('')}</ol>`;
}

/** Doel, voortgang, beurten, logboek en "Wat doet …?" van de huidige scène — of de afloop als die vaststaat. */
function actionBlock(game: Game, state: SceneState, sc: SceneView): string {
  const progress = sceneProgress(state);
  let dots = '';
  for (let i = 0; i < SCENE_GOAL; i++) dots += `<span class="dot ${i < progress ? 'on' : ''}"></span>`;
  const entries = state.log.filter((e) => e.scene === state.scene);
  const head = `<div class="scene-goal">
      <p><b>Doel van deze scène:</b> <span class="story-text">${escapeHtml(sc.doel)}</span></p>
      <p class="progress-line"><span class="dots" aria-label="${progress} van ${SCENE_GOAL} gelukt">${dots}</span>
        <span>${progress}/${SCENE_GOAL} gelukt</span><span>·</span><span class="turns">beurten over: <b>${turnsLeft(state)}</b>/${SCENE_TURNS}</span></p>
    </div>
    ${logList(entries, sc)}`;
  if (keyDone(state)) {
    const ok = state.keys[state.scene];
    const text = ok ? sc.gelukt : sc.mislukt;
    return `${head}<div class="key-result ${ok ? 'ok' : 'nok'}">
      <p class="key-verdict">${ok ? 'Scène gelukt! ★' : 'De beurten zijn op…'}</p>
      <p class="story-text">${escapeHtml(text)}</p>
      ${readBar(text, readerOf(game))}
      <button class="btn big primary" data-action="scene-next">${state.scene + 1 >= MOMENT_SCENE ? 'Verder: het beslissende moment ▶' : 'Verder in het verhaal ▶'}</button>
    </div>`;
  }
  const hero = currentHero(game);
  return `${head}<div class="scene-actions">
      <button class="btn big primary act-btn" data-action="act-open">Wat doet ${escapeHtml(hero?.name ?? '…')}?</button>
      <span class="hint">Overleg gerust samen. Wie aan de beurt is, kiest en rolt.</span>
    </div>`;
}

function playCard(game: Game, c: PlayContext): string {
  const state = c.state;
  const r = currentRound(game);
  const after = currentAftermath(game);
  const rollers = rollerCount(presentHeroes(game).length);
  const need = neededSuccesses(rollers, c.meter);
  const bonus = leadTotal(state);
  let body: string;
  if (state.momentDone && c.result) {
    const text = after?.text ?? c.outcome(c.result !== 'mislukt');
    body = `<div class="moment done ${c.result === 'mislukt' ? 'nok' : 'ok'}">
      <p class="moment-result">${c.resultLabel(c.result)}</p>
      <p class="moment-text story-text">${escapeHtml(text)}</p>
      ${readBar(text, readerOf(game))}
      ${c.result !== 'mislukt' && !c.rewardTaken ? '<button class="btn big reward-btn" data-action="reward">Beloning: jullie vinden iets!</button>' : ''}
      <p class="hint">${c.doneHint}</p>
    </div>`;
  } else if (r) {
    const s = successes(game, r);
    const total = Math.min(rollers, s.count + bonus);
    body = `<div class="moment">
      <h3>Beslissend moment</h3>
      <p class="moment-text story-text">${escapeHtml(c.moment ?? '')}</p>
      <p>Elke held rolt één keer (4 of meer). Jullie hebben <b>${need} van ${rollers}</b> successen nodig.
        ${bonus > 0 ? `Jullie voorsprong telt mee: <b>${stars(bonus, bonus)} = ${bonus}</b>.` : ''} Nu: <b>${total}</b>.</p>
      ${bonus >= need ? '<p class="lead-safe">Dankzij jullie voorsprong is het al gelukt! Rol nu voor een <b>perfecte</b> afloop.</p>' : ''}
      ${rollersList(game, r)}
    </div>`;
  } else if (state.scene >= MOMENT_SCENE) {
    const momentTxt = c.moment ?? '';
    body = `<div class="scene moment-scene">
      <p class="scene-label">${SCENE_NAMES[MOMENT_SCENE]} — lees voor!</p>
      <p class="moment-text story-text">${escapeHtml(momentTxt)}</p>
      ${readBar(momentTxt, readerOf(game))}
      <button class="btn big primary" data-action="moment-start">Start het beslissende moment</button>
      <p class="hint">Elke held rolt één keer. Nodig: ${need} van ${rollers} successen${bonus > 0 ? ` — jullie voorsprong (${bonus} ★) telt mee` : ''}.</p>
    </div>`;
  } else {
    const sc = c.scenes[state.scene];
    const readText =
      state.scene === 0 ? [c.recap ? `Vorige keer in Kakofonië: ${c.recap}` : '', c.intro ?? '', sc.tekst].filter(Boolean).join(' ') : sc.tekst;
    body = `<div class="scene">
      <p class="scene-label">${SCENE_NAMES[state.scene]} — lees voor!</p>
      <p class="scene-text story-text">${escapeHtml(sc.tekst)}</p>
      ${state.log.some((e) => e.scene === state.scene) ? '' : readBar(readText, readerOf(game))}
      ${actionBlock(game, state, sc)}
    </div>`;
  }
  // Wat er al gebeurde: eerdere scènes met hun logboek en afloop.
  const earlier = c.scenes.slice(0, Math.min(state.scene, c.scenes.length));
  const earlierHtml =
    earlier.length > 0 && !state.momentDone
      ? `<details class="earlier"><summary>Wat er al gebeurde (${earlier.length})</summary>${earlier
          .map(
            (sc, i) => `<p><b>${SCENE_NAMES[i]}:</b> <span class="story-text">${escapeHtml(sc.tekst)}</span></p>
              ${logList(state.log.filter((e) => e.scene === i), sc)}
              <p><b>${state.keys[i] ? 'Gelukt' : 'Mislukt'}:</b> <span class="story-text">${escapeHtml(state.keys[i] ? sc.gelukt : sc.mislukt)}</span></p>`,
          )
          .join('')}</details>`
      : '';
  const facts = [
    c.plaats ? `<li><b>Waar:</b> <span class="story-text">${escapeHtml(c.plaats.naam)} — ${escapeHtml(c.plaats.beschrijving)}</span></li>` : '',
    c.figuur ? `<li><b>Wie loopt er rond:</b> <span class="story-text">${escapeHtml(c.figuur.naam)} — ${escapeHtml(c.figuur.beschrijving)}</span></li>` : '',
  ].join('');
  return `<article class="chapter">
    <p class="chapter-label">${c.label} · scène ${Math.min(state.scene, SCENES - 1) + 1} van ${SCENES}</p>
    <h3 class="chapter-title">${escapeHtml(c.titel)}</h3>
    ${c.recap && state.scene === 0 ? `<p class="recap"><b>Vorige keer in Kakofonië:</b> <span class="story-text">${escapeHtml(c.recap)}</span></p>` : ''}
    ${c.intro && state.scene === 0 ? `<p class="story-text villain-intro">${escapeHtml(c.intro)}</p>` : ''}
    ${facts ? `<ul class="chapter-facts">${facts}</ul>` : ''}
    <p class="goal"><b>Jullie doel vandaag:</b> <span class="story-text">${escapeHtml(c.doel)}</span></p>
    ${earlierHtml}
    ${body}
  </article>`;
}

function seasonContext(season: Season): PlayContext {
  const v = chapterView(season);
  const next = season.chapter + 1 >= CHAPTERS ? 'de finale' : `hoofdstuk ${season.chapter + 2}`;
  return {
    state: season,
    label: `Hoofdstuk ${v.number} van ${CHAPTERS}`,
    titel: v.titel,
    recap: v.recap,
    intro: v.intro,
    scenes: v.scenes,
    doel: v.doel,
    plaats: v.plaats,
    figuur: v.figuur,
    moment: v.moment,
    meter: season.meter,
    result: season.momentDone ? season.results[season.chapter] ?? null : null,
    outcome: (success) => momentText(season, success),
    resultLabel: (r) =>
      r === 'perfect' ? 'Perfect! De meter zakt én jullie vinden een aanwijzing.' : r === 'gehaald' ? 'Gelukt! Jullie vinden een aanwijzing.' : 'Mislukt… De Slechterik-meter stijgt met 2.',
    doneHint: `Dit hoofdstuk is klaar. Stop de sessie en bewaar. Volgende keer: <b>${next}</b>.`,
    rewardTaken: season.rewardTaken,
  };
}

function finaleCard(game: Game, season: Season): string {
  const f = finaleView(season);
  const r = currentRound(game);
  const after = currentAftermath(game);
  let body: string;
  if (season.finished) {
    body = `<div class="moment done ok won">
      <p class="moment-result">GEWONNEN!</p>
      <p class="moment-text story-text">${escapeHtml(after?.text ?? finaleWonText(season))}</p>
      ${readBar(after?.text ?? finaleWonText(season), readerOf(game))}
      <p class="hint">Het seizoen is uit. Stop de sessie en bewaar. Volgende keer kan er een nieuw seizoen beginnen.</p>
    </div>`;
  } else if (r) {
    const s = successes(game, r);
    body = `<div class="moment">
      <h3>Finaleronde ${finaleRounds + 1}</h3>
      <p>Elke held rolt één keer (4 of meer). Elk succes kost <span class="story-text">${escapeHtml(villainName(season))}</span> een leven. Nu: <b>${s.count}</b>.</p>
      ${rollersList(game, r)}
    </div>`;
  } else {
    body = `${after && after.kind === 'finale-round' ? `<p class="moment-text story-text">${escapeHtml(after.text)}</p>${readBar(after.text, readerOf(game))}` : ''}
      <div class="moment-start">
        <button class="btn big primary" data-action="finale-round">${finaleRounds === 0 && !after ? 'Start de finale!' : 'Volgende ronde!'}</button>
      </div>`;
  }
  return `<article class="chapter finale">
    <p class="chapter-label">De finale</p>
    ${hearts(season)}
    ${f.recap ? `<p class="recap"><b>Vorige keer in Kakofonië:</b> <span class="story-text">${escapeHtml(f.recap)}</span></p>` : ''}
    <p class="story-text">${escapeHtml(f.tekst)}</p>
    ${finaleRounds === 0 && !after ? readBar([f.recap ? `Vorige keer in Kakofonië: ${f.recap}` : '', f.tekst, f.zwakte ? `Jullie kennen zijn zwakte: ${f.zwakte}` : ''].filter(Boolean).join(' '), readerOf(game)) : ''}
    <p class="goal">${
      f.zwakte
        ? `<b>Jullie kennen zijn zwakte:</b> <span class="story-text">${escapeHtml(f.zwakte)}</span>`
        : '<b>Zijn zwakte kennen jullie niet…</b> Daarom heeft hij extra levens.'
    }</p>
    ${body}
  </article>`;
}

/** HTML voor het seizoensdeel van de speeltafel. */
export function seasonBlock(app: App): string {
  const game = requireGame(app);
  const season = game.season;
  if (!season || game.sessionMode !== 'seizoen') return '';
  const clues = clueTexts(season);
  return `<section class="season">
    <header class="season-head">
      <div class="season-title">Seizoen van <b class="story-text">${escapeHtml(villainName(season))}</b>${isTestContent() ? ' <span class="test-badge">TESTVERHAAL</span>' : ''}</div>
      ${meter(season)}
      ${isFinale(season) ? '' : lead(season)}
      <div class="clue-count">Aanwijzingen: <b>${season.clues}/${CHAPTERS}</b></div>
    </header>
    ${isFinale(season) ? finaleCard(game, season) : playCard(game, seasonContext(season))}
    ${
      clues.length > 0
        ? `<details class="clues"><summary>Gevonden aanwijzingen (${clues.length})</summary><ol>${clues
            .map((c) => `<li class="story-text">${escapeHtml(c)}</li>`)
            .join('')}</ol></details>`
        : ''
    }
  </section>`;
}

/** HTML voor een los avontuur op de speeltafel. */
export function adventureBlock(app: App): string {
  const game = requireGame(app);
  const adv = game.adventure;
  if (game.sessionMode !== 'los') return '';
  if (!adv) {
    return `<section class="season"><div class="chapter"><p>Er is nog geen avontuur gekozen.</p>
      <button class="btn big primary" data-action="adventure-other">Kies een avontuur</button></div></section>`;
  }
  const v = adventureView(adv);
  const fresh = adv.scene === 0 && adv.log.length === 0 && !adv.momentDone;
  const ctx: PlayContext = {
    state: adv,
    label: 'Los avontuur',
    titel: v.titel,
    recap: null,
    intro: v.intro,
    scenes: v.scenes,
    doel: v.doel,
    plaats: null,
    figuur: null,
    moment: v.moment,
    meter: 0,
    result: adv.result,
    outcome: (success) => adventureOutcome(adv, success),
    resultLabel: (r) => (r === 'perfect' ? 'Perfect! Wat een avontuur!' : r === 'gehaald' ? 'Gelukt!' : 'Net niet… maar wat een verhaal!'),
    doneHint: 'Het avontuur is uit. Stop de sessie en bewaar.',
    rewardTaken: adv.rewardTaken,
  };
  return `<section class="season adventure">
    <header class="season-head">
      <div class="season-title">Los avontuur${isTestAdventures() ? ' <span class="test-badge">TESTVERHAAL</span>' : ''}</div>
      ${lead(adv)}
      ${fresh ? '<button class="btn small" data-action="adventure-other">Ander avontuur</button>' : ''}
    </header>
    ${playCard(game, ctx)}
  </section>`;
}

function resolveIfDone(app: App): void {
  const game = requireGame(app);
  const r = currentRound(game);
  if (!r) return;
  const s = successes(game, r);
  if (!s.done) return;
  const key = keyOf(game);
  round = null;
  const season = game.season;
  if (game.sessionMode === 'seizoen' && season && isFinale(season)) {
    const won = recordFinaleRound(game, s.count);
    aftermath = { key, kind: won ? 'won' : 'finale-round', text: won ? finaleWonText(season) : finaleRoundText(season, finaleRounds) };
    finaleRounds += 1;
  } else {
    const result = recordMoment(game, s.count);
    const text = game.sessionMode === 'los' && game.adventure ? adventureOutcome(game.adventure, result !== 'mislukt') : season ? momentText(season, result !== 'mislukt') : '';
    aftermath = { key, kind: 'moment', text };
  }
  app.changed();
}

/** Handelt de knoppen van het seizoens-/avontuurdeel af. Geeft true terug als de actie hier hoorde. */
export async function handleSeasonAction(app: App, action: string, id: string): Promise<boolean> {
  const game = requireGame(app);
  const play = activePlay(game);
  const season = game.session > 0 && game.sessionMode === 'seizoen' ? game.season : null;
  switch (action) {
    case 'act-open':
      openActions(app);
      return true;
    case 'scene-next':
      if (!play || !keyDone(play)) return true;
      nextScene(game);
      app.changed();
      // Meteen (niet vloeiend) naar het begin van het hoofdstuk: een tik tijdens het scrollen zou ernaast landen.
      document.querySelector('.chapter')?.scrollIntoView({ block: 'start' });
      return true;
    case 'reward':
      if (await openFind(app, 'Beloning! Jullie vinden iets')) takeReward(game);
      app.changed();
      return true;
    case 'moment-start':
      if (!(await confirmDialog('Klaar voor het beslissende moment? Daarna is dit hoofdstuk voorbij.', 'Ja, nu!', 'Nog even spelen'))) return true;
      round = { key: keyOf(game), rolls: {}, allyDie: null };
      aftermath = null;
      app.changed();
      return true;
    case 'finale-round':
      if (!season || season.hearts === null || season.finished) return true;
      round = { key: keyOf(game), rolls: {}, allyDie: null };
      app.changed();
      return true;
    case 'group-roll': {
      const r = currentRound(game);
      if (!r || id in r.rolls) return true;
      const hero = findHero(game, id);
      openDice(app, id, {
        title: season && isFinale(season) ? `${hero.name} valt aan!` : `${hero.name}: beslissend moment`,
        onResult: (success) => {
          r.rolls[id] = success;
          resolveIfDone(app);
        },
      });
      return true;
    }
    case 'ally-roll': {
      const r = currentRound(game);
      if (!r || r.allyDie !== null) return true;
      r.allyDie = rollDice(1)[0];
      app.changed();
      resolveIfDone(app);
      return true;
    }
    default:
      return false;
  }
}

/** Nieuwe sessie/nieuw spel: vergeet de tijdelijke groepsworp en keuzes. */
export function resetSeasonUi(): void {
  round = null;
  aftermath = null;
  finaleRounds = 0;
}
