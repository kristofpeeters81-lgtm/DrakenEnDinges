// Codeert verborgen verhaalinhoud (spoilers) naar een TypeScript-bestand dat papa niet per ongeluk kan lezen.
// Gebruik: node scripts/encode-content.mjs <invoer.json> <naam>
//   → schrijft src/content/<naam>.data.ts en toont ENKEL het aantal items (nooit de inhoud).
// Zet de leesbare invoer altijd BUITEN de repo (bv. in een tijdelijke map) en verwijder ze daarna.

import fs from 'node:fs';
import path from 'node:path';

const [input, name] = process.argv.slice(2);
if (!input || !name || !/^[a-z0-9-]+$/.test(name)) {
  console.error('Gebruik: node scripts/encode-content.mjs <invoer.json> <naam-in-kleine-letters>');
  process.exit(1);
}

const value = JSON.parse(fs.readFileSync(input, 'utf8'));
const encoded = Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
const lines = encoded.match(/.{1,100}/g) ?? [];
const out = path.resolve('src/content', `${name}.data.ts`);
const body = `// SPOILER-INHOUD — niet decoderen of tonen. Zie CLAUDE.md (spoilerregel).
// Gegenereerd met: node scripts/encode-content.mjs <invoer.json> ${name}
export const DATA =
${lines.map((l) => `  '${l}'`).join(' +\n')};
`;
fs.writeFileSync(out, body);
const count = Array.isArray(value) ? value.length : Object.keys(value).length;
console.log(`OK: ${count} items gecodeerd naar ${path.relative(process.cwd(), out)}`);
