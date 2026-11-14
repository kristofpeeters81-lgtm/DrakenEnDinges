// Eind-tot-eind-test in echte Chrome/Edge (headless): klikt het hele spel door en maakt screenshots.
// Gebruik: npm run e2e   (screenshots komen in e2e-output/)
//          npm run e2e:prod  (test de productiebuild, inclusief de veiligheidsregel)

import { createServer, preview } from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const PROD = process.argv.includes('--prod');
const OUT = path.resolve('e2e-output');
const DOWNLOADS = path.join(OUT, 'downloads');
const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(
    (p) => fs.existsSync(p),
  );

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(DOWNLOADS, { recursive: true });

let step = 0;
function check(ok, message) {
  if (!ok) throw new Error(`MISLUKT: ${message}`);
  console.log(`  ✓ ${message}`);
}

const server = PROD
  ? await preview({ preview: { port: 4348, strictPort: false } })
  : await createServer({ server: { port: 5348, strictPort: false }, logLevel: 'error' }).then((s) => s.listen());
const url = (server.resolvedUrls?.local ?? [])[0];
console.log(`Test op ${url} (${PROD ? 'productiebuild' : 'ontwikkelserver'})`);

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--lang=nl-BE'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });
page.on('pageerror', (err) => {
  console.error('Fout in de pagina:', err.message);
  process.exitCode = 1;
});
// Desktop-Windows kent ook een deelmenu: in de test altijd de download-route gebruiken.
await page.evaluateOnNewDocument(() => {
  Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
  // Spoilerregel: verborgen inhoud wazig maken, zodat ze nooit leesbaar in een screenshot staat.
  document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = '.opening-text, .opening-title, .eida-event, .story-text, .chapter-title { filter: blur(7px) !important; }';
    document.head.appendChild(style);
  });
});
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DOWNLOADS });

const shot = (name) => page.screenshot({ path: path.join(OUT, `${String(++step).padStart(2, '0')}-${name}.png`) });
const click = async (selector) => {
  await page.waitForSelector(selector, { visible: true });
  await page.click(selector);
};
const text = (selector) => page.$eval(selector, (el) => el.textContent ?? '');
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

const waitDialog = (needle) =>
  page.waitForFunction((n) => !document.getElementById('dialog').hidden && document.getElementById('dialog-text').textContent.includes(n), {}, needle);
const answer = async (needle, value) => {
  await waitDialog(needle);
  await click(`#dialog-buttons [data-value="${value}"]`);
  // Gesloten, of meteen een volgende vraag (die opent soms in hetzelfde moment).
  await page.waitForFunction(
    (n) => document.getElementById('dialog').hidden || !document.getElementById('dialog-text').textContent.includes(n),
    {},
    needle,
  );
};

async function startSessionAs(kind) {
  await click('[data-action="start"]');
  await answer('Wat spelen', kind);
  await page.waitForSelector('.turn-banner');
}

async function stopSessionLater() {
  await click('[data-action="stop"]');
  await answer('stoppen', 'yes');
  await answer('bewaren', 'later');
  await page.waitForSelector('.hero-card');
}

async function realRollInPanel(value) {
  await click('[data-action="real"]');
  await page.waitForSelector('.dice-panel.mode-enter');
  await click(`[data-action="pip"][data-id="${value}"]`);
  await page.waitForSelector('.dice-panel.mode-result');
  await click('.dice-panel [data-action="close"].btn.big');
  await page.waitForSelector('#overlay', { hidden: true });
}

/** Beslissend moment of finaleronde: elke held rolt de gegeven waarde, de bondgenoot rolt in de app. */
async function playGroup(value) {
  while (await page.$('.rollers [data-action="group-roll"]')) {
    await click('.rollers [data-action="group-roll"]');
    await realRollInPanel(value);
  }
  if (await page.$('.rollers [data-action="ally-roll"]')) await click('.rollers [data-action="ally-roll"]');
}

async function playMoment(goal, value) {
  while (await page.$('[data-action="scene-next"]')) {
    await click('[data-action="scene-next"]');
    await answer('scène', 'yes');
  }
  await click('[data-action="moment-start"]');
  await answer('beslissende moment', 'yes');
  await answer('doel', goal);
  await page.waitForSelector('.rollers');
  await playGroup(value);
  await page.waitForSelector('.moment.done');
}

async function fill(field, value) {
  const sel = `input[data-field="${field}"]`;
  await page.$eval(sel, (el) => {
    el.value = '';
  });
  await page.type(sel, value);
}

try {
  if (PROD) {
    const html = await (await fetch(url)).text();
    check(html.includes("connect-src 'none'"), 'veiligheidsregel (geen internetverbindingen) staat in de build');
  }

  console.log('Startscherm');
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  check((await page.$('[data-action="continue"]')) === null, 'zonder reservekopie geen "Verder spelen"');
  await shot('startscherm');

  console.log('Helden maken');
  await click('[data-action="new"]');
  await page.waitForSelector('.add-card');
  await shot('helden-leeg');

  // Held 1: alles verzonnen door de dobbelsteen
  await click('.add-card');
  await click('[data-action="invent-all"]');
  await fill('player', 'Papa');
  const hero1 = await page.$eval('input[data-field="name"]', (el) => el.value);
  check(hero1.length > 0, `"Alles verzinnen" vult een naam in (${hero1})`);
  await shot('aanmaakscherm-verzonnen');
  await click('.hero-form button[type="submit"]');
  await page.waitForSelector('.hero-card');

  // Held 2: zelf ingevuld, met een zelfverzonnen kracht → moet goedgekeurd worden
  await click('.add-card');
  await fill('name', 'Mie Mosselman');
  await fill('player', 'Mama');
  await fill('kind', 'Heks die bang is van katten');
  await fill('good0', 'Toveren');
  await fill('good1', 'Ruiken');
  await fill('badAt', 'Wachten');
  await fill('power', 'Spaghetti uit mijn oren schieten');
  check(await page.$eval('.approve', (el) => !el.hidden), 'zelfverzonnen kracht toont de goedkeuringsvraag');
  await click('.hero-form button[type="submit"]');
  await page.waitForSelector('.errors:not([hidden])');
  check((await text('.errors')).includes('ja'), 'zonder goedkeuring wordt de held geweigerd');
  await shot('aanmaakscherm-goedkeuring');
  await click('.approve input');
  await click('.hero-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('.hero-card').length === 2);

  // Held 3: gast die vandaag niet meespeelt
  await click('.add-card');
  await click('[data-action="invent-all"]');
  await fill('player', 'Oma');
  await click('.hero-form button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('.hero-card').length === 3);
  await page.$$eval('.hero-card .switch', (els) => els[2].click());
  await page.waitForFunction(() => document.querySelectorAll('.hero-card.absent').length === 1);
  check((await text('.screen-footer .hint')).includes('2 helden'), 'gast uitgezet: 2 helden spelen mee');
  await shot('helden-overzicht');

  console.log('Sessie en dobbelen');
  await startSessionAs('los');
  check((await text('.turn-name')) === hero1, 'held 1 is eerst aan de beurt');
  check((await page.$$('.table-card')).length === 2, 'enkel meespelende helden op tafel');

  // Beginscène: inhoud nooit tonen, enkel vergelijken
  const opening1 = await text('.opening-text');
  check(opening1.length > 150, 'bij de start staat er een beginscène (inhoud niet getoond)');
  await click('[data-action="opening-other"]');
  await click('#dialog-buttons [data-value="yes"]');
  await page.waitForFunction((prev) => document.querySelector('.opening-text')?.textContent !== prev, {}, opening1);
  check(true, '"Andere beginscène" geeft een andere');
  await click('[data-action="opening-toggle"]');
  await page.waitForSelector('.opening.collapsed');
  check((await page.$('.opening-text')) === null, 'beginscène kan ingeklapt worden');
  await click('[data-action="opening-toggle"]');
  await page.waitForSelector('.opening-text');
  const openingKept = await text('.opening-text');
  await shot('speeltafel');

  const cardButton = (i) => page.$$eval('.table-card', (cards, n) => cards[n].querySelector('.roll-small')?.textContent ?? '', i);
  const closeResult = async () => {
    await click('.dice-panel [data-action="close"].btn.big');
    await page.waitForSelector('#overlay', { hidden: true });
  };

  // a. Uitzonderlijke worp van Mie (niet aan de beurt): beurt blijft bij held 1, Mie op slot
  await page.$$eval('.table-card', (cards) => cards[1].querySelector('[data-action="roll"]').click());
  await click('[data-action="app-roll"]');
  await page.waitForSelector('.dice-panel.mode-result', { timeout: 5000 });
  await closeResult();
  check((await text('.turn-name')) === hero1, 'uitzonderlijke worp: beurt blijft bij held 1');
  check((await cardButton(1)).includes('Al gerold'), 'Mie staat op slot na haar uitzonderlijke worp');

  // b. Held 1 rolt in de app met "goed in" en hulp van Mie: na Klaar automatisch Mie aan de beurt
  await click('.turn-banner [data-action="roll"]');
  await page.waitForSelector('.dice-panel.mode-setup');
  await click('[data-action="edge"][data-id="goed"]');
  await page.$$eval('[data-action="helper"]', (els) => els[1].click());
  await shot('dobbelen-keuze');
  check((await text('.explain')).includes('helper'), 'uitleg vermeldt de helper');
  await click('[data-action="app-roll"]');
  await page.waitForSelector('.dice-panel.mode-result', { timeout: 5000 });
  check((await page.$$('.dice-panel .die-wrap')).length === 3, 'goed in + hulp = 3 dobbelstenen');
  check((await page.$$('.dice-panel .die-wrap.kept')).length === 1, 'precies één dobbelsteen telt');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.verdict')).opacity === '1');
  await shot('dobbelen-resultaat-app');
  await closeResult();
  check((await text('.turn-name')) === 'Mie Mosselman', 'na Klaar gaat de beurt automatisch naar Mie');
  check((await cardButton(0)).includes('Al gerold'), 'held 1 staat op slot tot zijn volgende beurt');
  check(!(await cardButton(1)).includes('Al gerold'), 'Mie mag weer rollen nu ze zelf aan de beurt is');

  // c. Mie rolt echt: 2 (mislukt), frietje opeten, 5 (gelukt), daarna beurt terug naar held 1
  await click('.turn-banner [data-action="roll"]');
  await click('[data-action="real"]');
  await page.waitForSelector('.dice-panel.mode-enter');
  await click('[data-action="pip"][data-id="2"]');
  await page.waitForSelector('.verdict.nok');
  check((await text('.verdict')).includes('MISLUKT'), 'echte worp 2 → mislukt');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.verdict')).opacity === '1');
  await shot('dobbelen-mislukt');
  await click('[data-action="retry"]');
  await page.waitForSelector('.dice-panel.mode-enter');
  await click('[data-action="pip"][data-id="5"]');
  await page.waitForSelector('.verdict.ok');
  check((await text('.verdict')).includes('GELUKT'), 'na een frietje: 5 → gelukt');
  await closeResult();
  check((await text('.turn-name')) === hero1, 'beurt terug naar held 1');
  const fries2 = await page.$$eval('.table-card', (cards) => cards[1].querySelector('.fries-label b')?.textContent);
  check(fries2 === '2', 'Mie heeft nog 2 frietjes');

  // Sluiten zonder te rollen telt niet als worp
  await click('.turn-banner [data-action="roll"]');
  await page.waitForSelector('.dice-panel.mode-setup');
  await click('.close-x');
  await page.waitForSelector('#overlay', { hidden: true });
  check((await text('.turn-name')) === hero1 && !(await cardButton(0)).includes('Al gerold'), 'venster sluiten zonder rollen = geen worp');

  // Held 1 eet een frietje met de min-knop, Mie gebruikt haar kracht en verdient een frietje, volgende beurt
  await page.$$eval('.table-card', (cards) => cards[0].querySelector('[data-action="eat"]').click());
  await page.$$eval('.table-card', (cards) => cards[1].querySelector('[data-action="power"]').click());
  await page.$$eval('.table-card', (cards) => cards[1].querySelector('[data-action="fry"]').click());
  await click('[data-action="next"]');
  await page.waitForFunction(() => document.querySelector('.turn-name')?.textContent === 'Mie Mosselman');
  check(true, 'volgende beurt: Mie Mosselman');
  check((await page.$$eval('.table-card .power.used', (els) => els.length)) === 1, 'kracht van Mie staat op gebruikt');
  await shot('speeltafel-na-beurt');

  console.log('Orakel (Pruttelpot)');
  const turnBefore = await text('.turn-name');
  await click('[data-action="oracle"]');
  await page.waitForSelector('.oracle-panel.mode-setup');
  await page.type('input[data-field="question"]', 'Is er een geheime deur?');
  await click('[data-action="likely"][data-id="waarschijnlijk"]');
  await shot('orakel-vraag');
  await click('[data-action="real"]');
  await page.waitForSelector('.oracle-panel.mode-enter');
  await click('[data-action="pip"][data-id="2"]');
  await click('[data-action="pip"][data-id="5"]');
  await page.waitForSelector('.oracle-panel.mode-result');
  check((await text('.answer')) === 'Ja.', 'waarschijnlijk met 2 en 5: hoogste telt, antwoord "Ja."');
  check((await text('.question')).includes('geheime deur'), 'de vraag staat groot bij het antwoord');
  await click('[data-action="again"]');
  await page.waitForSelector('.oracle-panel.mode-setup');
  check((await page.$eval('input[data-field="question"]', (el) => el.value)) === '', 'nog een vraag: leeg vraagveld');
  await click('[data-action="real"]');
  await click('[data-action="pip"][data-id="1"]');
  await page.waitForSelector('.oracle-panel.mode-result');
  check((await text('.answer')).startsWith('Nee, en'), '50/50 met 1: "Nee, en het is nog erger"');
  check((await page.$('.prikkel-inline')) !== null, 'bij "…en" komt er een zotte prikkel bij');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.answer')).opacity === '1');
  await shot('orakel-antwoord');
  await click('[data-action="again"]');
  await click('[data-action="app-roll"]');
  await page.waitForSelector('.oracle-panel.mode-result', { timeout: 4000 });
  check((await text('.answer')).length > 0, 'de pot pruttelt ook zelf een antwoord');
  await click('.oracle-panel .dice-actions [data-action="close"]');
  await page.waitForSelector('#overlay', { hidden: true });
  check((await page.$$('.oracle-history li')).length === 3, 'de laatste 3 antwoorden staan op de speeltafel');
  check((await text('.turn-name')) === turnBefore, 'het orakel verandert de beurt niet');

  await click('[data-action="prikkel"]');
  await page.waitForSelector('.prikkel-big');
  check((await text('.prikkel-big')).trim().split(' ').length === 2, 'zotte prikkel = twee woorden');
  await click('.oracle-panel [data-action="close"].btn');
  await page.waitForSelector('#overlay', { hidden: true });

  // Eidastinkt: verborgen inhoud. Enkel controleren dat er iets verschijnt, nooit tonen of fotograferen.
  await click('[data-action="eida"]');
  await page.waitForSelector('.eida-event');
  check((await text('.eida-event')).length > 10, 'Eidastinkt! toont een voorval (inhoud niet getoond)');
  await click('.eida-panel [data-action="close"].btn');
  await page.waitForSelector('#overlay', { hidden: true });

  console.log('Bewaren en laden');
  check((await text('[data-action="save"]')).includes('Bewaren!'), 'bewaar-knop valt op bij niet-bewaarde wijzigingen');
  await click('[data-action="save"]');
  let file = null;
  for (let i = 0; i < 50 && !file; i++) {
    await pause(100);
    file = fs.readdirSync(DOWNLOADS).find((f) => f.endsWith('.txt'));
  }
  check(file !== null && file !== undefined, `spelbestand gedownload (${file})`);
  const saved = JSON.parse(fs.readFileSync(path.join(DOWNLOADS, file), 'utf8'));
  check(saved.app === 'draken-en-dinges' && saved.version === 5, 'bestand heeft app-naam en versie (5)');
  check(saved.game.heroes.length === 3, 'bestand bevat alle 3 de helden (ook de gast)');
  await page.waitForFunction(() => document.querySelector('[data-action="save"]')?.textContent?.includes('Bewaard'));
  check(true, 'bewaar-knop toont "Bewaard"');

  // Tablet met deelmenu nabootsen: Bewaren moet dan vragen waar het bestand naartoe moet.
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(Navigator.prototype, 'share', { value: async () => undefined, configurable: true });
  });
  await click('[data-action="save"]');
  await page.waitForSelector('#dialog:not([hidden])');
  const choices = await page.$$eval('#dialog-buttons button', (els) => els.map((e) => e.textContent));
  check(choices.some((c) => c.includes('Downloads')) && choices.some((c) => c.includes('Delen')), 'met deelmenu: keuze tussen Downloads en Delen');
  await click('#dialog-buttons [data-value="share"]');
  await page.waitForFunction(() => document.querySelector('#toast')?.textContent?.includes('Gedeeld'));
  check((await text('#toast')).includes('.txt'), 'na delen toont de app de bestandsnaam');
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, 'canShare', { value: undefined, configurable: true });
  });

  // Alles in de browser wissen → spel moet volledig terugkomen uit het bestand
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle0' });
  check((await page.$('[data-action="continue"]')) === null, 'na wissen: geen reservekopie meer');
  const [chooser] = await Promise.all([page.waitForFileChooser(), page.click('[data-action="load"]')]);
  await chooser.accept([path.join(DOWNLOADS, file)]);
  await page.waitForFunction(() => document.querySelectorAll('.hero-card').length === 3);
  check(true, 'na laden: 3 helden terug');
  check((await page.$$('.hero-card.absent')).length === 1, 'gast staat nog steeds op "speelt niet mee"');
  await shot('na-laden');
  await click('[data-action="start"]');
  await page.waitForSelector('.turn-banner');
  check((await text('.turn-name')) === 'Mie Mosselman', 'beurt is bewaard gebleven');
  check((await text('.opening-text')) === openingKept, 'beginscène is bewaard gebleven');
  const friesAfter = await page.$$eval('.table-card .fries-label b', (els) => els.map((e) => e.textContent));
  check(friesAfter.join(',') === '2,3', `frietjes bewaard gebleven (${friesAfter.join(',')})`);

  console.log('Seizoen (testinhoud)');
  await stopSessionLater();
  await startSessionAs('seizoen');
  await page.waitForSelector('.season');
  check((await page.$('.opening')) === null, 'in een seizoen geen losse beginscène');
  check((await page.$('.test-badge')) !== null, 'testinhoud is herkenbaar als TESTVERHAAL');
  check((await text('.chapter-label')).includes('Hoofdstuk 1 van 3'), 'seizoen start bij hoofdstuk 1');
  check((await text('.meter b')) === '0/6', 'Slechterik-meter start op 0');
  await shot('seizoen-hoofdstuk-1');
  check((await text('.scene-label')).includes('Het begin'), 'hoofdstuk start met de beginscène');
  check((await page.$('[data-action="moment-start"]')) === null, 'beslissend moment komt pas na de scènes');
  await click('[data-action="ideas-toggle"]');
  await page.waitForSelector('.ideas-list');
  check((await page.$$('.ideas-list li')).length >= 2, 'ideeën als jullie vastzitten: minstens 2');
  await click('[data-action="scene-next"]');
  await answer('scène', 'yes');
  await page.waitForFunction(() => document.querySelector('.scene-label')?.textContent?.includes('wending'));
  check(true, 'verder in het verhaal: de wending');
  check((await page.$('.earlier')) !== null, 'de eerdere scène blijft na te lezen');
  check((await page.$('.ideas-list')) === null, 'ideeën klappen dicht bij een nieuwe scène');
  await shot('seizoen-wending');

  // Geslaagde gewone worp → voorsprong-ster
  await click('.turn-banner [data-action="roll"]');
  await realRollInPanel(6);
  check((await page.$$('.lead .star.on')).length === 1, 'geslaagde worp geeft een voorsprong-ster');

  // Beslissend moment: doel gehaald, maar alle worpen mislukken → toch gehaald dankzij de voorsprong
  await playMoment('yes', 1);
  check((await page.$('.moment.done.ok')) !== null, 'goede avond + slechte worpen op het einde = toch gehaald');
  check((await text('.clue-count b')) === '1/3', 'gehaald: eerste aanwijzing gevonden');
  check((await text('.meter b')) === '0/6', 'gehaald: meter blijft op 0');
  await shot('seizoen-moment-gehaald');

  // Hoofdstuk 2: geen voorsprong, alles mislukt → meter +2
  await stopSessionLater();
  check((await text('[data-action="start"]')).includes('Start sessie'), 'nieuwe sessie na een afgerond hoofdstuk');
  await startSessionAs('seizoen');
  check((await text('.chapter-label')).includes('Hoofdstuk 2 van 3'), 'volgende sessie = hoofdstuk 2');
  check((await page.$('.recap')) !== null, 'hoofdstuk 2 begint met "Vorige keer in Kakofonië"');
  await playMoment('no', 1);
  check((await page.$('.moment.done.nok')) !== null, 'zonder voorsprong en met slechte worpen: mislukt');
  check((await text('.meter b')) === '2/6', 'mislukt: meter stijgt met 2');

  // Hoofdstuk 3: alles gelukt
  await stopSessionLater();
  await startSessionAs('seizoen');
  check((await text('.chapter-label')).includes('Hoofdstuk 3 van 3'), 'hoofdstuk 3');
  await playMoment('yes', 6);
  check((await text('.clue-count b')) === '2/3', 'tweede aanwijzing');

  // Finale: rondes tot de slechterik verslagen is
  await stopSessionLater();
  await startSessionAs('seizoen');
  check((await text('.chapter-label')).includes('finale'), 'na 3 hoofdstukken: de finale');
  const heartsStart = (await page.$$('.heart.full')).length;
  check(heartsStart >= 1, `de slechterik heeft ${heartsStart} ${heartsStart === 1 ? 'leven' : 'levens'}`);
  await shot('seizoen-finale');
  let rounds = 0;
  while (!(await page.$('.moment.won')) && rounds < 10) {
    await click('[data-action="finale-round"]');
    await page.waitForSelector('.rollers');
    await playGroup(rounds === 0 ? 1 : 6);
    await page.waitForFunction(() => !document.querySelector('.rollers'));
    rounds++;
  }
  check((await page.$('.moment.won')) !== null, `finale gewonnen na ${rounds} ${rounds === 1 ? 'ronde' : 'rondes'}`);
  await shot('seizoen-gewonnen');
  await stopSessionLater();
  await click('[data-action="start"]');
  await waitDialog('Wat spelen');
  const labels = await page.$$eval('#dialog-buttons button', (els) => els.map((e) => e.textContent));
  check(labels.some((l) => l.includes('Nieuw seizoen')), 'na een gewonnen seizoen: "Nieuw seizoen"');
  await click('#dialog-buttons [data-value="cancel"]');

  console.log('Kapot bestand');
  const broken = path.join(DOWNLOADS, 'kapot.txt');
  fs.writeFileSync(broken, 'dit is geen spel');
  await page.goto(url, { waitUntil: 'networkidle0' });
  const [chooser2] = await Promise.all([page.waitForFileChooser(), page.click('[data-action="load"]')]);
  await chooser2.accept([broken]);
  await page.waitForSelector('#toast.error:not([hidden])');
  check((await text('#toast')).includes('geen spelbestand'), 'kapot bestand geeft een duidelijke melding');
  check((await page.$('[data-action="continue"]')) !== null, 'spel in het geheugen blijft intact');

  console.log('Gsm-formaat');
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await click('[data-action="continue"]');
  await page.waitForSelector('.hero-card');
  await startSessionAs('seizoen');
  await shot('gsm-speeltafel');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, 'geen horizontaal scrollen op gsm');

  console.log(`\nAlles in orde. Screenshots in ${OUT}`);
} catch (err) {
  console.error(`\n${err.message}`);
  await shot('FOUT').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  if (PROD) server.httpServer.close();
  else await server.close();
}
