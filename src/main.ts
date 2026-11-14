// Draken & Dinges — controller: houdt het open spel bij, wisselt van scherm en regelt het bewaren.

import '@fontsource/luckiest-guy/400.css';
import '@fontsource/patrick-hand/400.css';
import './styles.css';
import type { App, Screen } from './app';
import { saveFileName, serializeGame } from './game/save';
import { markFileSaved, type Game } from './game/state';
import { canShareFiles, exportTextFile, type ExportMode } from './platform/file';
import { renderEditor } from './screens/editor';
import { renderHeroes } from './screens/heroes';
import { renderHome } from './screens/home';
import { renderTable } from './screens/table';
import { requestPersistence, writeAutosave } from './storage/autosave';
import { warmUpVoices } from './platform/speech';
import { installReadAloud } from './ui/readaloud';
import { $ } from './ui/dom';
import { ask, toast } from './ui/dialog';
import { takeTitleNews } from './game/state';

const root = $('#app');
let game: Game | null = null;
let screen: Screen = { name: 'home' };
let autosaveWarned = false;

function persist(): void {
  if (!game) return;
  if (!writeAutosave(game) && !autosaveWarned) {
    autosaveWarned = true;
    toast('Automatisch bewaren lukt niet op dit toestel. Bewaar uw spel als bestand!', 'error');
  }
}

function render(): void {
  if (screen.name !== 'home' && !game) screen = { name: 'home' };
  switch (screen.name) {
    case 'home':
      renderHome(app);
      break;
    case 'heroes':
      renderHeroes(app);
      break;
    case 'editor':
      renderEditor(app, screen.heroId);
      break;
    case 'table':
      renderTable(app);
      break;
  }
}

const app: App = {
  root,
  get game() {
    return game;
  },
  setGame(next) {
    game = next;
    persist();
  },
  go(next) {
    screen = next;
    render();
    window.scrollTo(0, 0);
  },
  changed() {
    persist();
    render();
    const titles = takeTitleNews();
    if (titles.length > 0) toast(`🏆 Nieuwe titel — ${titles.join(' · ')}`);
  },
  async saveToFile() {
    if (!game) return;
    const current = game;
    let mode: ExportMode = 'download';
    if (canShareFiles()) {
      const choice = await ask('Waar wilt ge het spel bewaren?', [
        { label: 'Delen (Drive, WhatsApp…)', value: 'share' },
        { label: 'Op deze tablet (Downloads)', value: 'download', primary: true },
      ]);
      if (choice === null) return;
      mode = choice === 'share' ? 'share' : 'download';
    }
    // Eerst markeren, dan pas wegschrijven: zo staat "bewaard" ook in het bestand zelf. Lukt het niet: terugzetten.
    const before = current.lastFileSave;
    try {
      const now = new Date();
      const fileName = saveFileName(now);
      markFileSaved(current, now.getTime());
      const result = await exportTextFile(serializeGame(current, now.getTime()), fileName, mode);
      if (result === 'geannuleerd') {
        current.lastFileSave = before;
        toast('Niet bewaard.');
      } else if (result === 'gedeeld') {
        toast(`Gedeeld: “${fileName}”. Bewaar het goed!`);
      } else {
        toast(`Bewaard in Downloads (app Bestanden): “${fileName}”`);
      }
    } catch {
      current.lastFileSave = before;
      toast('Bewaren lukte niet. Probeer het nog eens.', 'error');
    }
    app.changed();
  },
};

requestPersistence();
installReadAloud();
warmUpVoices();
render();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Geen offline-modus beschikbaar; de app werkt gewoon online verder.
    });
  });
}
