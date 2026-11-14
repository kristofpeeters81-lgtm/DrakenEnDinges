// Level-up: kies 1 uit 3 beloningskaarten (met een vervolgkeuze waar nodig: welk talent, welk voorwerp, welk maatje).

import { requireGame, type App } from '../app';
import { getItem } from '../content';
import { BUDDIES } from '../data/growth-data';
import { GOOD_AT } from '../data/ideas';
import { CARD_TEXT, ITEM_LEVEL_NAMES, MAX_ITEM_LEVEL, offerCards, type CardChoice, type CardKind } from '../game/growth';
import { chooseLevelCard, findHero } from '../game/state';
import { toast } from '../ui/dialog';
import { actionOf, escapeHtml, $ } from '../ui/dom';

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function openLevelUp(app: App, heroId: string): void {
  const game = requireGame(app);
  const hero = findHero(game, heroId);
  const overlay = $('#overlay');
  let cards: CardKind[] = offerCards(hero);
  let picked: CardKind | null = null;
  let choice: CardChoice = {};
  let talentOptions: string[] = [];
  let buddyOptions: number[] = [];

  const close = (): void => {
    overlay.hidden = true;
    overlay.innerHTML = '';
    overlay.onclick = null;
    overlay.oninput = null;
    app.changed();
  };

  const follow = (): string => {
    if (picked === 'talent') {
      return `<p class="q">Waar wordt ${escapeHtml(hero.name)} goed in?</p>
        <div class="segs wrap">${talentOptions.map((t) => `<button class="seg ${choice.talent === t ? 'active' : ''}" data-action="talent" data-id="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div>
        <label class="field level-own"><span class="field-label">Of zelf iets verzinnen</span>
          <input type="text" data-field="talent" maxlength="60" placeholder="bv. Spaghetti eten zonder morsen" value="${talentOptions.includes(choice.talent ?? '') ? '' : escapeHtml(choice.talent ?? '')}" /></label>`;
    }
    if (picked === 'voorwerp') {
      return `<p class="q">Welk voorwerp wordt sterker?</p><div class="segs wrap">${hero.items
        .map((it, slot) =>
          it.level < MAX_ITEM_LEVEL
            ? `<button class="seg ${choice.slot === slot ? 'active' : ''}" data-action="slot" data-id="${slot}"><span class="story-text">${escapeHtml(getItem(it.item)?.naam ?? 'Voorwerp')}</span><small>${ITEM_LEVEL_NAMES[it.level - 1]} → ${ITEM_LEVEL_NAMES[it.level]}</small></button>`
            : '',
        )
        .join('')}</div>`;
    }
    if (picked === 'maatje') {
      return `<p class="q">Welk maatje gaat er mee?</p><div class="segs wrap">${buddyOptions
        .map((k) => `<button class="seg ${choice.buddyKind === k ? 'active' : ''}" data-action="buddy" data-id="${k}">${escapeHtml(BUDDIES[k].naam)}<small>${escapeHtml(BUDDIES[k].soort)}</small></button>`)
        .join('')}</div>`;
    }
    return '';
  };

  const render = (): void => {
    overlay.innerHTML = `<div class="dice-panel levelup-panel" role="dialog" aria-modal="true">
      <button class="btn ghost close-x" data-action="close" aria-label="Later kiezen">✕</button>
      <h2>Level-up voor ${escapeHtml(hero.name)}!</h2>
      <p class="explain">Niveau ${hero.level} → ${hero.level + 1}. Kies één beloning.${hero.pendingLevelUps > 1 ? ` (Nog ${hero.pendingLevelUps} level-ups te kiezen.)` : ''}</p>
      <div class="cards">${cards
        .map(
          (c) => `<button class="reward-card ${picked === c ? 'active' : ''}" data-action="card" data-id="${c}">
            <b>${escapeHtml(CARD_TEXT[c].titel)}</b><span>${escapeHtml(CARD_TEXT[c].uitleg)}</span></button>`,
        )
        .join('')}</div>
      ${follow()}
      <div class="dice-actions">
        <button class="btn big primary" data-action="confirm" ${picked ? '' : 'disabled'}>Kies deze beloning</button>
      </div>
    </div>`;
  };

  overlay.oninput = (e) => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.dataset.field === 'talent') choice.talent = t.value;
  };
  overlay.onclick = (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    switch (hit.action) {
      case 'close':
        close();
        return;
      case 'card':
        picked = hit.id as CardKind;
        choice = {};
        if (picked === 'talent') {
          const own = [hero.goodAt[0], hero.goodAt[1], ...hero.extraGood].map((s) => s.toLowerCase());
          talentOptions = shuffle(GOOD_AT.filter((g) => !own.includes(g.toLowerCase()))).slice(0, 6);
        }
        if (picked === 'maatje') buddyOptions = shuffle(BUDDIES.map((_, i) => i)).slice(0, 3);
        break;
      case 'talent':
        choice.talent = hit.id;
        break;
      case 'slot':
        choice.slot = Number(hit.id);
        break;
      case 'buddy':
        choice.buddyKind = Number(hit.id);
        break;
      case 'confirm': {
        if (!picked) return;
        const error = chooseLevelCard(game, heroId, picked, choice);
        if (error) {
          toast(error, 'error');
          return;
        }
        toast(`${hero.name} is nu niveau ${hero.level}!`);
        if (hero.pendingLevelUps > 0) {
          cards = offerCards(hero);
          picked = null;
          choice = {};
          app.changed();
          break;
        }
        close();
        return;
      }
    }
    render();
  };

  overlay.hidden = false;
  render();
}
