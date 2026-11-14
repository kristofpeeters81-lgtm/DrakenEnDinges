// Controleert een (leesbaar) bestand met losse avonturen op vorm, ZONDER inhoud te tonen.
// Gebruik: node scripts/check-adventures.mjs <avonturen.json>
//
// Een los avontuur = één avond, gebouwd als een mini-hoofdstuk:
//   { titel, intro, doel, begin: scène, wending: { gelukt: scène, mislukt: scène },
//     moment: { gelukt, mislukt }, gelukt, mislukt }
//   scène = { tekst, doel, acties: [8–10 × { label, past, gelukt, mislukt }], gelukt, mislukt }

import fs from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('Gebruik: node scripts/check-adventures.mjs <avonturen.json>');
  process.exit(1);
}

const problems = [];
const str = (v, where, min = 1, max = 2000) => {
  if (typeof v !== 'string' || v.trim().length < min) problems.push(`${where}: ontbreekt of te kort`);
  else if (v.length > max) problems.push(`${where}: te lang (${v.length} > ${max})`);
  else if (/\{\w+\}/.test(v)) problems.push(`${where}: plaatshouders zijn niet toegelaten in losse avonturen`);
};
const scene = (sc, where) => {
  if (!sc || typeof sc !== 'object') return problems.push(`${where}: ontbreekt`);
  str(sc.tekst, `${where}.tekst`, 200, 750);
  str(sc.doel, `${where}.doel`, 15, 160);
  if (!Array.isArray(sc.acties) || sc.acties.length < 8 || sc.acties.length > 10) problems.push(`${where}.acties: 8–10 nodig`);
  const labels = new Set();
  (sc.acties ?? []).forEach((a, i) => {
    const wa = `${where}.acties[${i}]`;
    str(a?.label, `${wa}.label`, 3, 70);
    str(a?.past, `${wa}.past`, 3, 60);
    str(a?.gelukt, `${wa}.gelukt`, 40, 300);
    str(a?.mislukt, `${wa}.mislukt`, 40, 300);
    if (labels.has(a?.label)) problems.push(`${wa}.label: dubbel`);
    labels.add(a?.label);
  });
  str(sc.gelukt, `${where}.gelukt`, 60, 450);
  str(sc.mislukt, `${where}.mislukt`, 60, 450);
};

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
if (!Array.isArray(data) || data.length < 15) problems.push('avonturen: minstens 15 nodig');
const titles = new Set();
(Array.isArray(data) ? data : []).forEach((a, i) => {
  const w = `[${i}]`;
  str(a.titel, `${w}.titel`, 3, 40);
  if (titles.has(a.titel)) problems.push(`${w}.titel: dubbel`);
  titles.add(a.titel);
  str(a.intro, `${w}.intro`, 60, 400);
  str(a.doel, `${w}.doel`, 20, 250);
  scene(a.begin, `${w}.begin`);
  scene(a.wending?.gelukt, `${w}.wending.gelukt`);
  scene(a.wending?.mislukt, `${w}.wending.mislukt`);
  str(a.moment?.gelukt, `${w}.moment.gelukt`, 60, 550);
  str(a.moment?.mislukt, `${w}.moment.mislukt`, 60, 550);
  str(a.gelukt, `${w}.gelukt`, 60, 500);
  str(a.mislukt, `${w}.mislukt`, 60, 500);
});

console.log(`avonturen ${Array.isArray(data) ? data.length : 0} · problemen ${problems.length}`);
for (const p of problems) console.log(`- ${p}`);
process.exit(problems.length === 0 ? 0 : 1);
