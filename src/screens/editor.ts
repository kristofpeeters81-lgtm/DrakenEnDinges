// Aanmaakscherm: een held maken of aanpassen. Elk veld kan zelf ingevuld worden, uit een lijst gekozen,
// of door de dobbelsteen "verzonnen". Een zelfverzonnen kracht moet door de tafel goedgekeurd worden.

import { requireGame, topbar, type App } from '../app';
import { BAD_AT, GOOD_AT, HERO_NAMES, KINDS, pick, POWERS } from '../data/ideas';
import { addHero, draftOf, emptyDraft, findHero, needsApproval, updateHero, validateDraft, type HeroDraft } from '../game/state';
import { actionOf, DICE_ICON, escapeHtml, $ } from '../ui/dom';
import { toast } from '../ui/dialog';

type Field = 'name' | 'player' | 'kind' | 'good0' | 'good1' | 'badAt' | 'power';

function getField(d: HeroDraft, f: Field): string {
  switch (f) {
    case 'good0':
      return d.goodAt[0];
    case 'good1':
      return d.goodAt[1];
    default:
      return d[f];
  }
}

function setField(d: HeroDraft, f: Field, value: string): void {
  switch (f) {
    case 'good0':
      d.goodAt = [value, d.goodAt[1]];
      break;
    case 'good1':
      d.goodAt = [d.goodAt[0], value];
      break;
    default:
      d[f] = value;
  }
}

/** Verzint een waarde voor een veld (nooit dezelfde als wat er al staat of als het andere "goed in"). */
function invent(d: HeroDraft, f: Field): string | null {
  switch (f) {
    case 'name':
      return pick(HERO_NAMES, [d.name]);
    case 'kind':
      return pick(KINDS, [d.kind]);
    case 'good0':
    case 'good1':
      return pick(GOOD_AT, [d.goodAt[0], d.goodAt[1]]);
    case 'badAt':
      return pick(BAD_AT, [d.badAt]);
    case 'power':
      return pick(POWERS, [d.power]);
    case 'player':
      return null;
  }
}

function datalist(id: string, items: readonly string[]): string {
  return `<datalist id="${id}">${items.map((i) => `<option value="${escapeHtml(i)}"></option>`).join('')}</datalist>`;
}

function row(f: Field, label: string, d: HeroDraft, opts: { list?: string; placeholder: string; dice: boolean }): string {
  return `
    <label class="field">
      <span class="field-label">${label}</span>
      <span class="field-row">
        <input type="text" data-field="${f}" value="${escapeHtml(getField(d, f))}" placeholder="${escapeHtml(opts.placeholder)}"
          ${opts.list ? `list="${opts.list}"` : ''} maxlength="80" autocomplete="off" />
        ${opts.dice ? `<button type="button" class="btn icon" data-action="invent" data-id="${f}" title="Verzin iets">${DICE_ICON}</button>` : ''}
      </span>
    </label>`;
}

export function renderEditor(app: App, heroId: string | null): void {
  const game = requireGame(app);
  const draft: HeroDraft = heroId ? draftOf(findHero(game, heroId)) : emptyDraft();
  const title = heroId ? 'Held aanpassen' : 'Nieuwe held';

  app.root.innerHTML = `
    <section class="screen editor">
      ${topbar(title, { action: 'back', label: 'Terug' }, `<button class="btn" data-action="invent-all">${DICE_ICON} Alles verzinnen</button>`)}
      <form class="hero-form" novalidate>
        <div class="form-grid">
          ${row('name', 'Naam van uw held', draft, { placeholder: 'hoe zotter, hoe beter', dice: true })}
          ${row('player', 'Gespeeld door', draft, { placeholder: 'bv. Papa', dice: false })}
          ${row('kind', 'Soort', draft, { list: 'dl-kind', placeholder: 'bv. trol die koekjes bakt', dice: true })}
          ${row('badAt', 'Slecht in', draft, { list: 'dl-bad', placeholder: 'bv. stil zijn', dice: true })}
          ${row('good0', 'Goed in (1)', draft, { list: 'dl-good', placeholder: 'bv. klimmen', dice: true })}
          ${row('good1', 'Goed in (2)', draft, { list: 'dl-good', placeholder: 'bv. zeveren', dice: true })}
        </div>
        ${row('power', 'Speciale kracht', draft, { list: 'dl-power', placeholder: 'kies uit de lijst of verzin iets', dice: true })}
        <p class="rule">1× per sessie · lukt altijd, zonder rollen · duurt hoogstens 1 scène.<br>
          <b>Niet toegelaten:</b> onoverwinnelijk zijn, alles kunnen of de slechterik in één keer verslaan. Een kracht doet één ding.</p>
        <label class="approve" ${needsApproval(draft.power) ? '' : 'hidden'}>
          <input type="checkbox" data-field="approved" ${draft.powerApproved ? 'checked' : ''} />
          <span>Dit is een zelfverzonnen kracht: <b>iedereen aan tafel zei “ja”</b>.</span>
        </label>
        <ul class="errors" hidden></ul>
        <button type="submit" class="btn big primary">${heroId ? 'Bewaar held' : 'Maak held'}</button>
      </form>
      ${datalist('dl-kind', KINDS)}${datalist('dl-good', GOOD_AT)}${datalist('dl-bad', BAD_AT)}${datalist('dl-power', POWERS)}
    </section>`;

  const form = $('.hero-form', app.root);
  const approve = $('.approve', app.root);
  const errorsBox = $('.errors', app.root);

  const refreshApproval = (): void => {
    approve.hidden = !needsApproval(draft.power);
  };
  const setInput = (f: Field, value: string): void => {
    setField(draft, f, value);
    const input = app.root.querySelector<HTMLInputElement>(`input[data-field="${f}"]`);
    if (input) input.value = value;
    if (f === 'power') {
      draft.powerApproved = false;
      const box = app.root.querySelector<HTMLInputElement>('input[data-field="approved"]');
      if (box) box.checked = false;
      refreshApproval();
    }
  };

  app.root.oninput = (e) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement)) return;
    const f = target.dataset.field;
    if (f === 'approved') {
      draft.powerApproved = target.checked;
    } else if (f) {
      setField(draft, f as Field, target.value);
      if (f === 'power') refreshApproval();
    }
  };
  // Checkbox: sommige browsers sturen geen input-event.
  app.root.onchange = (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.dataset.field === 'approved') draft.powerApproved = target.checked;
  };

  app.root.onclick = (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    if (hit.action === 'back') {
      app.go({ name: 'heroes' });
    } else if (hit.action === 'invent') {
      const value = invent(draft, hit.id as Field);
      if (value !== null) setInput(hit.id as Field, value);
    } else if (hit.action === 'invent-all') {
      for (const f of ['name', 'kind', 'good0', 'good1', 'badAt', 'power'] as const) {
        const value = invent(draft, f);
        if (value !== null) setInput(f, value);
      }
    }
  };

  form.onsubmit = (e) => {
    e.preventDefault();
    const errors = validateDraft(draft);
    if (errors.length > 0) {
      errorsBox.innerHTML = errors.map((m) => `<li>${escapeHtml(m)}</li>`).join('');
      errorsBox.hidden = false;
      errorsBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    try {
      if (heroId) updateHero(game, heroId, draft);
      else addHero(game, draft);
      app.changed();
      toast(heroId ? `${draft.name.trim()} is aangepast.` : `Welkom in Kakofonië, ${draft.name.trim()}!`);
      app.go({ name: 'heroes' });
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Oei, er ging iets mis.', 'error');
    }
  };
}
