// Controleert een (leesbaar) seizoensbestand op vorm en plaatshouders, ZONDER inhoud te tonen.
// Gebruik: node scripts/check-seasons.mjs <seizoenen.json>
// Toont enkel aantallen en plaatsen van problemen (bv. "slechteriken[1].stappen[0].wending.gelukt.ideeen: te weinig").
//
// Vorm per hoofdstuk (vertakkingen):
//   begin            = scène { tekst, ideeen, sleutel }
//   wending.gelukt   = scène als sleutelmoment 1 gelukt is;  wending.mislukt = als het mislukt is
//   moment.gelukt    = climax als sleutelmoment 2 gelukt is; moment.mislukt  = als het mislukt is
//   sleutel          = { vraag, aanpakken: [{ label, past }], gelukt, mislukt }  (gevolgteksten)

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Gebruik: node scripts/check-seasons.mjs <seizoenen.json>');
  process.exit(1);
}

const CHAPTERS = 3;
const ALLOWED = new Set(['slechterik', 'handlanger', 'plaats', 'figuur']);
const problems = [];
const str = (v, where, min = 1, max = 2000) => {
  if (typeof v !== 'string' || v.trim().length < min) problems.push(`${where}: ontbreekt of te kort`);
  else if (v.length > max) problems.push(`${where}: te lang (${v.length} > ${max})`);
  else for (const m of v.matchAll(/\{(\w+)\}/g)) if (!ALLOWED.has(m[1])) problems.push(`${where}: onbekende plaatshouder {${m[1]}}`);
};
const list = (v, where, min, maxEach, max = 99) => {
  if (!Array.isArray(v) || v.length < min || v.length > max) problems.push(`${where}: ${min}–${max} nodig`);
  else v.forEach((s, i) => str(s, `${where}[${i}]`, 1, maxEach));
};
const key = (k, where) => {
  if (!k || typeof k !== 'object') return problems.push(`${where}: ontbreekt`);
  str(k.vraag, `${where}.vraag`, 15, 200);
  if (!Array.isArray(k.aanpakken) || k.aanpakken.length < 2 || k.aanpakken.length > 3) problems.push(`${where}.aanpakken: 2–3 nodig`);
  (k.aanpakken ?? []).forEach((a, i) => {
    str(a?.label, `${where}.aanpakken[${i}].label`, 3, 70);
    str(a?.past, `${where}.aanpakken[${i}].past`, 3, 80);
  });
  str(k.gelukt, `${where}.gelukt`, 60, 450);
  str(k.mislukt, `${where}.mislukt`, 60, 450);
};
const scene = (sc, where) => {
  if (!sc || typeof sc !== 'object') return problems.push(`${where}: ontbreekt`);
  str(sc.tekst, `${where}.tekst`, 200, 750);
  list(sc.ideeen, `${where}.ideeen`, 2, 160, 3);
  key(sc.sleutel, `${where}.sleutel`);
};

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (data.test) problems.push('test: moet weg (echte inhoud)');
if (!Array.isArray(data.slechteriken) || data.slechteriken.length < 3) problems.push('slechteriken: minstens 3 nodig');
(data.slechteriken ?? []).forEach((v, i) => {
  const w = `slechteriken[${i}]`;
  str(v.naam, `${w}.naam`, 3, 60);
  str(v.intro, `${w}.intro`, 80, 500);
  str(v.doel, `${w}.doel`, 20, 300);
  str(v.handlanger, `${w}.handlanger`, 3, 60);
  str(v.zwakte, `${w}.zwakte`, 20, 300);
  list(v.aanwijzingen, `${w}.aanwijzingen`, CHAPTERS, 300, CHAPTERS);
  if (!Array.isArray(v.stappen) || v.stappen.length !== CHAPTERS) problems.push(`${w}.stappen: precies ${CHAPTERS} nodig`);
  (v.stappen ?? []).forEach((s, j) => {
    const ws = `${w}.stappen[${j}]`;
    str(s.titel, `${ws}.titel`, 3, 60);
    str(s.doel, `${ws}.doel`, 20, 250);
    if ('scenes' in s || typeof s.moment === 'string') problems.push(`${ws}: oude vorm (scenes/moment-tekst) — gebruik begin/wending/moment`);
    scene(s.begin, `${ws}.begin`);
    scene(s.wending?.gelukt, `${ws}.wending.gelukt`);
    scene(s.wending?.mislukt, `${ws}.wending.mislukt`);
    str(s.moment?.gelukt, `${ws}.moment.gelukt`, 60, 550);
    str(s.moment?.mislukt, `${ws}.moment.mislukt`, 60, 550);
    str(s.gelukt, `${ws}.gelukt`, 40, 400);
    str(s.mislukt, `${ws}.mislukt`, 40, 400);
  });
  const f = v.finale ?? {};
  str(f.tekst, `${w}.finale.tekst`, 150, 700);
  list(f.rondes, `${w}.finale.rondes`, 3, 300, 5);
  str(f.gewonnen, `${w}.finale.gewonnen`, 100, 700);
});
if (!Array.isArray(data.plaatsen) || data.plaatsen.length < 6) problems.push('plaatsen: minstens 6 nodig');
(data.plaatsen ?? []).forEach((p, i) => { str(p.naam, `plaatsen[${i}].naam`, 3, 50); str(p.beschrijving, `plaatsen[${i}].beschrijving`, 20, 200); });
if (!Array.isArray(data.figuren) || data.figuren.length < 4) problems.push('figuren: minstens 4 nodig');
(data.figuren ?? []).forEach((p, i) => { str(p.naam, `figuren[${i}].naam`, 3, 50); str(p.beschrijving, `figuren[${i}].beschrijving`, 20, 200); });

console.log(`slechteriken ${data.slechteriken?.length ?? 0} · plaatsen ${data.plaatsen?.length ?? 0} · figuren ${data.figuren?.length ?? 0} · problemen ${problems.length}`);
for (const p of problems) console.log(`- ${p}`);
process.exit(problems.length === 0 ? 0 : 1);
