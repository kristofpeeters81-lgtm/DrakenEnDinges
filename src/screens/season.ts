// Seizoen op de speeltafel: Slechterik-meter, hoofdstuk (scènes met sleutelmomenten en vertakkingen), beslissend
// moment en finalerondes. De voortgang van een groepsworp en de keuzes in een sleutelmoment zitten enkel in het
// geheugen; pas de uitkomst wordt in het spel bewaard.

import { requireGame, type App } from '../app';
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
  rollerCount,
  SCENES,
  type Season,
} from '../game/season';
import { findHero, nextScene, presentHeroes, recordFinaleRound, recordKeyResult, recordMoment, takeReward, type Game } from '../game/state';
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

/** Keuzes in het sleutelmoment van de huidige scène. */
interface KeyChoice {
  key: string;
  approach: number | null;
  heroId: string | null;
}

const SCENE_NAMES = ['Het begin', 'De wending', 'Het beslissende moment'];

let round: GroupRound | null = null;
/** Ideeën opengeklapt voor deze scène (sleutel = hoofdstuk + scène). */
let ideasOpenFor = '';
let keyChoice: KeyChoice | null = null;
let aftermath: Aftermath | null = null;
let finaleRounds = 0;

function keyOf(game: Game, season: Season): string {
  return `${game.id}|${season.villain}|${season.chapter}|${game.session}`;
}

function sceneKey(game: Game, season: Season): string {
  return `${keyOf(game, season)}|${season.scene}`;
}

function currentRound(game: Game, season: Season): GroupRound | null {
  return round && round.key === keyOf(game, season) ? round : null;
}

function currentAftermath(game: Game, season: Season): Aftermath | null {
  return aftermath && aftermath.key === keyOf(game, season) ? aftermath : null;
}

function currentChoice(game: Game, season: Season): KeyChoice | null {
  return keyChoice && keyChoice.key === sceneKey(game, season) ? keyChoice : null;
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

/** Voorsprong: één ster per sleutelmoment (gelukt = aan), plus een bonusster als ze allemaal lukten. */
function lead(season: Season): string {
  if (isFinale(season) || season.momentDone) return '';
  let out = '';
  for (let i = 0; i < KEY_MOMENTS; i++) out += `<span class="star ${season.keys[i] === true ? 'on' : ''}">★</span>`;
  const bonus = season.keys.length === KEY_MOMENTS && season.keys.every(Boolean);
  return `<div class="lead" title="1 ster per gelukt sleutelmoment, +1 als ze allemaal lukken">Voorsprong ${out}<span class="star bonus ${bonus ? 'on' : ''}">★</span></div>`;
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

/** Het sleutelmoment van een scène: nog te spelen (vraag, aanpakken, wie) of gespeeld (gevolg). */
function keyBlock(game: Game, season: Season, sc: SceneView): string {
  if (keyDone(season)) {
    const ok = season.keys[season.scene];
    const text = ok ? sc.sleutel.gelukt : sc.sleutel.mislukt;
    return `<div class="key-result ${ok ? 'ok' : 'nok'}">
      <p class="key-verdict">${ok ? 'Sleutelmoment gelukt! ★' : 'Sleutelmoment mislukt…'}</p>
      <p class="story-text">${escapeHtml(text)}</p>
      ${readBar(text, readerOf(game))}
      <button class="btn big primary" data-action="scene-next">${season.scene + 1 >= MOMENT_SCENE ? 'Verder: het beslissende moment ▶' : 'Verder in het verhaal ▶'}</button>
    </div>`;
  }
  const choice = currentChoice(game, season);
  if (!choice) {
    return `<div class="scene-actions">
      <button class="btn small" data-action="ideas-toggle">${ideasOpenFor === sceneKey(game, season) ? 'Ideeën verbergen' : 'Ideeën als jullie vastzitten'}</button>
      <button class="btn big primary" data-action="key-open">Naar het sleutelmoment ▶</button>
    </div>`;
  }
  const heroes = presentHeroes(game);
  return `<div class="key-moment">
    <p class="key-label">Sleutelmoment — wat staat er op het spel?</p>
    <p class="key-question story-text">${escapeHtml(sc.sleutel.vraag)}</p>
    <p class="q">Hoe pakken jullie het aan?</p>
    <div class="segs wrap">${sc.sleutel.aanpakken
      .map(
        (a, i) => `<button class="seg ${choice.approach === i ? 'active' : ''}" data-action="key-approach" data-id="${i}">
          <span class="story-text">${escapeHtml(a.label)}</span><small class="story-text">past bij: ${escapeHtml(a.past)}</small></button>`,
      )
      .join('')}</div>
    <p class="q">Wie probeert het?</p>
    <div class="segs wrap">${heroes
      .map((h) => `<button class="seg ${choice.heroId === h.id ? 'active' : ''}" data-action="key-hero" data-id="${h.id}">${escapeHtml(h.name)}</button>`)
      .join('')}</div>
    <p class="hint">Is die held goed in wat de aanpak vraagt? Kies dan “goed in” in het dobbelvenster.</p>
    <div class="dice-actions">
      <button class="btn big primary" data-action="key-roll" ${choice.approach !== null && choice.heroId ? '' : 'disabled'}>${DICE_ICON} Rol voor het sleutelmoment</button>
      <button class="btn ghost" data-action="key-cancel">Nog even spelen</button>
    </div>
  </div>`;
}

function chapterCard(game: Game, season: Season): string {
  const v = chapterView(season);
  const r = currentRound(game, season);
  const after = currentAftermath(game, season);
  const rollers = rollerCount(presentHeroes(game).length);
  const need = neededSuccesses(rollers, season.meter);
  const bonus = leadTotal(season);
  let body: string;
  if (season.momentDone) {
    const result = season.results[season.chapter];
    const text = after?.text ?? momentText(season, result !== 'mislukt');
    const label = result === 'perfect' ? 'Perfect! De meter zakt én jullie vinden een aanwijzing.' : result === 'gehaald' ? 'Gelukt! Jullie vinden een aanwijzing.' : 'Mislukt… De Slechterik-meter stijgt met 2.';
    const next = season.chapter + 1 >= CHAPTERS ? 'de finale' : `hoofdstuk ${season.chapter + 2}`;
    body = `<div class="moment done ${result === 'mislukt' ? 'nok' : 'ok'}">
      <p class="moment-result">${label}</p>
      <p class="moment-text story-text">${escapeHtml(text)}</p>
      ${readBar(text, readerOf(game))}
      ${result !== 'mislukt' && !season.rewardTaken ? '<button class="btn big reward-btn" data-action="reward">Beloning: jullie vinden iets!</button>' : ''}
      <p class="hint">Dit hoofdstuk is klaar. Stop de sessie en bewaar. Volgende keer: <b>${next}</b>.</p>
    </div>`;
  } else if (r) {
    const s = successes(game, r);
    const total = Math.min(rollers, s.count + bonus);
    body = `<div class="moment">
      <h3>Beslissend moment</h3>
      <p class="moment-text story-text">${escapeHtml(v.moment ?? '')}</p>
      <p>Elke held rolt één keer (4 of meer). Jullie hebben <b>${need} van ${rollers}</b> successen nodig.
        ${bonus > 0 ? `Jullie voorsprong telt mee: <b>${stars(bonus, bonus)} = ${bonus}</b>.` : ''} Nu: <b>${total}</b>.</p>
      ${bonus >= need ? '<p class="lead-safe">Dankzij jullie voorsprong is het al gelukt! Rol nu voor een <b>perfecte</b> afloop.</p>' : ''}
      ${rollersList(game, r)}
    </div>`;
  } else if (season.scene >= MOMENT_SCENE) {
    const momentTxt = v.moment ?? '';
    body = `<div class="scene moment-scene">
      <p class="scene-label">${SCENE_NAMES[MOMENT_SCENE]} — lees voor!</p>
      <p class="moment-text story-text">${escapeHtml(momentTxt)}</p>
      ${readBar(momentTxt, readerOf(game))}
      <button class="btn big primary" data-action="moment-start">Start het beslissende moment</button>
      <p class="hint">Elke held rolt één keer. Nodig: ${need} van ${rollers} successen${bonus > 0 ? ` — jullie voorsprong (${bonus} ★) telt mee` : ''}.</p>
    </div>`;
  } else {
    const sc = v.scenes[season.scene];
    const open = ideasOpenFor === sceneKey(game, season);
    const readText =
      season.scene === 0 ? [v.recap ? `Vorige keer in Kakofonië: ${v.recap}` : '', v.intro ?? '', sc.tekst].filter(Boolean).join(' ') : sc.tekst;
    body = `<div class="scene">
      <p class="scene-label">${SCENE_NAMES[season.scene]} — lees voor!</p>
      <p class="scene-text story-text">${escapeHtml(sc.tekst)}</p>
      ${keyDone(season) ? '' : readBar(readText, readerOf(game))}
      ${open && !keyDone(season) ? `<ul class="ideas-list">${sc.ideeen.map((i) => `<li class="story-text">${escapeHtml(i)}</li>`).join('')}</ul>` : ''}
      ${keyBlock(game, season, sc)}
    </div>`;
  }
  // Wat er al gebeurde: eerdere scènes met het gevolg van hun sleutelmoment.
  const earlier = v.scenes.slice(0, Math.min(season.scene, v.scenes.length));
  const earlierHtml =
    earlier.length > 0 && !season.momentDone
      ? `<details class="earlier"><summary>Wat er al gebeurde (${earlier.length})</summary>${earlier
          .map(
            (sc, i) => `<p><b>${SCENE_NAMES[i]}:</b> <span class="story-text">${escapeHtml(sc.tekst)}</span></p>
              <p><b>${season.keys[i] ? 'Gelukt' : 'Mislukt'}:</b> <span class="story-text">${escapeHtml(season.keys[i] ? sc.sleutel.gelukt : sc.sleutel.mislukt)}</span></p>`,
          )
          .join('')}</details>`
      : '';
  return `<article class="chapter">
    <p class="chapter-label">Hoofdstuk ${v.number} van ${CHAPTERS} · scène ${Math.min(season.scene, SCENES - 1) + 1} van ${SCENES}</p>
    <h3 class="chapter-title">${escapeHtml(v.titel)}</h3>
    ${v.recap && season.scene === 0 ? `<p class="recap"><b>Vorige keer in Kakofonië:</b> <span class="story-text">${escapeHtml(v.recap)}</span></p>` : ''}
    ${v.intro && season.scene === 0 ? `<p class="story-text villain-intro">${escapeHtml(v.intro)}</p>` : ''}
    <ul class="chapter-facts">
      <li><b>Waar:</b> <span class="story-text">${escapeHtml(v.plaats.naam)} — ${escapeHtml(v.plaats.beschrijving)}</span></li>
      <li><b>Wie loopt er rond:</b> <span class="story-text">${escapeHtml(v.figuur.naam)} — ${escapeHtml(v.figuur.beschrijving)}</span></li>
    </ul>
    <p class="goal"><b>Jullie doel vandaag:</b> <span class="story-text">${escapeHtml(v.doel)}</span></p>
    ${earlierHtml}
    ${body}
  </article>`;
}

function finaleCard(game: Game, season: Season): string {
  const f = finaleView(season);
  const r = currentRound(game, season);
  const after = currentAftermath(game, season);
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
      ${lead(season)}
      <div class="clue-count">Aanwijzingen: <b>${season.clues}/${CHAPTERS}</b></div>
    </header>
    ${isFinale(season) ? finaleCard(game, season) : chapterCard(game, season)}
    ${
      clues.length > 0
        ? `<details class="clues"><summary>Gevonden aanwijzingen (${clues.length})</summary><ol>${clues
            .map((c) => `<li class="story-text">${escapeHtml(c)}</li>`)
            .join('')}</ol></details>`
        : ''
    }
  </section>`;
}

function resolveIfDone(app: App): void {
  const game = requireGame(app);
  const season = game.season;
  if (!season) return;
  const r = currentRound(game, season);
  if (!r) return;
  const s = successes(game, r);
  if (!s.done) return;
  const key = keyOf(game, season);
  round = null;
  if (isFinale(season)) {
    const won = recordFinaleRound(game, s.count);
    aftermath = { key, kind: won ? 'won' : 'finale-round', text: won ? finaleWonText(season) : finaleRoundText(season, finaleRounds) };
    finaleRounds += 1;
  } else {
    const result = recordMoment(game, s.count);
    aftermath = { key, kind: 'moment', text: momentText(season, result !== 'mislukt') };
  }
  app.changed();
}

/** Handelt de knoppen van het seizoensdeel af. Geeft true terug als de actie hier hoorde. */
export async function handleSeasonAction(app: App, action: string, id: string): Promise<boolean> {
  const game = requireGame(app);
  const season = game.season;
  if (!season) return false;
  switch (action) {
    case 'ideas-toggle': {
      const key = sceneKey(game, season);
      ideasOpenFor = ideasOpenFor === key ? '' : key;
      app.changed();
      return true;
    }
    case 'key-open':
      if (!(await confirmDialog('Klaar met deze scène? Dan volgt het sleutelmoment.', 'Ja, nu!', 'Nog even spelen'))) return true;
      keyChoice = { key: sceneKey(game, season), approach: null, heroId: null };
      ideasOpenFor = '';
      app.changed();
      return true;
    case 'key-cancel':
      keyChoice = null;
      app.changed();
      return true;
    case 'key-approach': {
      const c = currentChoice(game, season);
      if (c) c.approach = Number(id);
      app.changed();
      return true;
    }
    case 'key-hero': {
      const c = currentChoice(game, season);
      if (c) c.heroId = id;
      app.changed();
      return true;
    }
    case 'key-roll': {
      const c = currentChoice(game, season);
      if (!c || c.approach === null || !c.heroId || keyDone(season)) return true;
      const hero = findHero(game, c.heroId);
      openDice(app, c.heroId, {
        title: `${hero.name}: sleutelmoment`,
        onResult: (success) => {
          recordKeyResult(game, success);
          keyChoice = null;
        },
      });
      return true;
    }
    case 'scene-next':
      if (!keyDone(season)) return true;
      nextScene(game);
      ideasOpenFor = '';
      keyChoice = null;
      app.changed();
      // Meteen (niet vloeiend) naar het begin van het hoofdstuk: een tik tijdens het scrollen zou ernaast landen.
      document.querySelector('.chapter')?.scrollIntoView({ block: 'start' });
      return true;
    case 'reward':
      if (season.rewardTaken || !season.momentDone) return true;
      if (await openFind(app, 'Beloning! Jullie vinden iets')) takeReward(game);
      app.changed();
      return true;
    case 'moment-start':
      if (!(await confirmDialog('Klaar voor het beslissende moment? Daarna is dit hoofdstuk voorbij.', 'Ja, nu!', 'Nog even spelen'))) return true;
      round = { key: keyOf(game, season), rolls: {}, allyDie: null };
      aftermath = null;
      app.changed();
      return true;
    case 'finale-round':
      if (season.hearts === null || season.finished) return true;
      round = { key: keyOf(game, season), rolls: {}, allyDie: null };
      app.changed();
      return true;
    case 'group-roll': {
      const r = currentRound(game, season);
      if (!r || id in r.rolls) return true;
      const hero = findHero(game, id);
      openDice(app, id, {
        title: isFinale(season) ? `${hero.name} valt aan!` : `${hero.name}: beslissend moment`,
        onResult: (success) => {
          r.rolls[id] = success;
          resolveIfDone(app);
        },
      });
      return true;
    }
    case 'ally-roll': {
      const r = currentRound(game, season);
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
  keyChoice = null;
  finaleRounds = 0;
}
