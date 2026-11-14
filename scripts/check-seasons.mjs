// Controleert een (leesbaar) seizoensbestand op vorm en plaatshouders, ZONDER inhoud te tonen.
// Gebruik: node scripts/check-seasons.mjs <seizoenen.json>
// Toont enkel aantallen en plaatsen van problemen (bv. "slechteriken[1].stappen[0].scenes[1].ideeen: te weinig").

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Gebruik: node scripts/check-seasons.mjs <seizoenen.json>');
  process.exit(1);
}

const CHAPTERS = 3;
const SCENES = 2;
const ALLOWED = new Set(['slechterik', 'handlanger', 'plaats', 'figuur']);
const problems = [];
const str = (v, where, min = 1, max = 2000) => {
  if (typeof v !== 'string' || v.trim().length < min) problems.push(`${where}: ontbreekt of te kort`);
  else if (v.length > max) problems.push(`${where}: te lang (${v.length} > ${max})`);
  else for (const m of v.matchAll(/\{(\w+)\}/g)) if (!ALLOWED.has(m[1])) problems.push(`${where}: onbekende plaatshouder {${m[1]}}`);
};
const list = (v, where, min, maxEach) => {
  if (!Array.isArray(v) || v.length < min) problems.push(`${where}: minstens ${min} nodig`);
  else v.forEach((s, i) => str(s, `${where}[${i}]`, 1, maxEach));
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
  list(v.aanwijzingen, `${w}.aanwijzingen`, CHAPTERS, 300);
  if (!Array.isArray(v.stappen) || v.stappen.length !== CHAPTERS) problems.push(`${w}.stappen: precies ${CHAPTERS} nodig`);
  (v.stappen ?? []).forEach((s, j) => {
    const ws = `${w}.stappen[${j}]`;
    str(s.titel, `${ws}.titel`, 3, 60);
    str(s.doel, `${ws}.doel`, 20, 250);
    str(s.moment, `${ws}.moment`, 60, 500);
    str(s.gelukt, `${ws}.gelukt`, 40, 400);
    str(s.mislukt, `${ws}.mislukt`, 40, 400);
    if (!Array.isArray(s.scenes) || s.scenes.length !== SCENES) problems.push(`${ws}.scenes: precies ${SCENES} nodig`);
    (s.scenes ?? []).forEach((sc, k) => {
      str(sc.tekst, `${ws}.scenes[${k}].tekst`, 200, 700);
      list(sc.ideeen, `${ws}.scenes[${k}].ideeen`, 2, 160);
    });
  });
  const f = v.finale ?? {};
  str(f.tekst, `${w}.finale.tekst`, 150, 700);
  list(f.rondes, `${w}.finale.rondes`, 3, 300);
  str(f.gewonnen, `${w}.finale.gewonnen`, 100, 700);
});
if (!Array.isArray(data.plaatsen) || data.plaatsen.length < 6) problems.push('plaatsen: minstens 6 nodig');
(data.plaatsen ?? []).forEach((p, i) => { str(p.naam, `plaatsen[${i}].naam`, 3, 50); str(p.beschrijving, `plaatsen[${i}].beschrijving`, 20, 200); });
if (!Array.isArray(data.figuren) || data.figuren.length < 4) problems.push('figuren: minstens 4 nodig');
(data.figuren ?? []).forEach((p, i) => { str(p.naam, `figuren[${i}].naam`, 3, 50); str(p.beschrijving, `figuren[${i}].beschrijving`, 20, 200); });

console.log(`slechteriken ${data.slechteriken?.length ?? 0} · plaatsen ${data.plaatsen?.length ?? 0} · figuren ${data.figuren?.length ?? 0} · problemen ${problems.length}`);
for (const p of problems) console.log(`- ${p}`);
process.exit(problems.length === 0 ? 0 : 1);
