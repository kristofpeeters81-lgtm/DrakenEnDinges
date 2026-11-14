// Startscherm: verder spelen, nieuw spel of spel laden uit een bestand.

import type { App } from '../app';
import { parseGame, SaveError } from '../game/save';
import { hasUnsavedChanges, newGame, type Game } from '../game/state';
import { pickTextFile } from '../platform/file';
import { readAutosave } from '../storage/autosave';
import { actionOf, escapeHtml, SHIELD_SVG } from '../ui/dom';
import { confirmDialog, toast } from '../ui/dialog';

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function summary(game: Game): string {
  const names = game.heroes.map((h) => h.name).join(', ') || 'nog geen helden';
  const session = game.session > 0 ? `sessie ${game.session}` : 'nog niet gespeeld';
  return `${names} · ${session} · ${fmtDate(game.updatedAt)}`;
}

/** Waarschuwt als het spel in het geheugen nog niet als bestand bewaard is. */
async function okToReplace(saved: Game | null): Promise<boolean> {
  if (!saved || !hasUnsavedChanges(saved)) return true;
  return confirmDialog(
    `Het spel van ${saved.heroes.map((h) => h.name).join(', ')} is nog niet als bestand bewaard. Als ge verdergaat, is het weg. Zeker?`,
    'Ja, weg ermee',
    'Nee, wacht',
  );
}

export function renderHome(app: App): void {
  const saved = readAutosave();
  app.root.innerHTML = `
    <section class="screen home">
      <div class="home-logo">${SHIELD_SVG}</div>
      <h1 class="title">Draken &amp; Dinges</h1>
      <p class="tagline">Het rollenspel van <b>Kakofonië</b> — waar niemand weet wat er gaat gebeuren.</p>
      <p class="motto">“Wie ’t riekt, heeft ’t gefliekt”</p>
      <div class="menu">
        ${
          saved && saved.heroes.length > 0
            ? `<button class="btn big primary" data-action="continue">Verder spelen<small>${escapeHtml(summary(saved))}</small></button>`
            : ''
        }
        <button class="btn big" data-action="new">Nieuw spel</button>
        <button class="btn big" data-action="load">Spel laden uit bestand</button>
      </div>
      <p class="hint">Tip: bewaar uw spel na elke sessie als bestand (Drive, WhatsApp…). Dan zijt ge het nooit kwijt.</p>
    </section>`;

  app.root.onchange = null;
  app.root.oninput = null;
  app.root.onclick = async (e) => {
    const hit = actionOf(e);
    if (!hit) return;
    try {
      if (hit.action === 'continue' && saved) {
        app.setGame(saved);
        app.go(saved.sessionActive ? { name: 'table' } : { name: 'heroes' });
      } else if (hit.action === 'new') {
        if (!(await okToReplace(saved))) return;
        app.setGame(newGame());
        app.go({ name: 'heroes' });
      } else if (hit.action === 'load') {
        const text = await pickTextFile();
        if (text === null) return;
        const game = parseGame(text);
        if (!(await okToReplace(saved))) return;
        app.setGame(game);
        toast(`Welkom terug, ${game.heroes.map((h) => h.name).join(', ') || 'helden'}!`);
        app.go({ name: 'heroes' });
      }
    } catch (err) {
      toast(err instanceof SaveError || err instanceof Error ? err.message : 'Oei, er ging iets mis.', 'error');
    }
  };
}
