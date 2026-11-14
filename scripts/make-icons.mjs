// Maakt de PNG-app-icoontjes (192, 512 en een "maskable" versie met marge) uit het wapenschild.
// Gebruik: node scripts/make-icons.mjs   → public/icons/*.png

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const CHROME =
  process.env.CHROME_PATH ??
  ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome'].find(
    (p) => fs.existsSync(p),
  );
const OUT = path.resolve('public/icons');
fs.mkdirSync(OUT, { recursive: true });
const svg = fs.readFileSync(path.resolve('public/favicon.svg'), 'utf8');

/** padding = marge rond het schild (maskable-icoontjes worden door Android rond bijgesneden). */
function page(size, padding) {
  const inner = size - 2 * padding;
  return `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:#fbf3e4;display:flex;align-items:center;justify-content:center">
    <div style="width:${inner}px;height:${inner}px;display:flex;align-items:center;justify-content:center">${svg.replace('<svg ', `<svg width="${Math.round(inner * 0.87)}" height="${inner}" `)}</div>
  </body></html>`;
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
const tab = await browser.newPage();
for (const [name, size, padding] of [
  ['icon-192.png', 192, 12],
  ['icon-512.png', 512, 32],
  ['icon-maskable-512.png', 512, 96],
]) {
  await tab.setViewport({ width: size, height: size });
  await tab.setContent(page(size, padding));
  await tab.screenshot({ path: path.join(OUT, name) });
  console.log(`✓ ${name}`);
}
await browser.close();
