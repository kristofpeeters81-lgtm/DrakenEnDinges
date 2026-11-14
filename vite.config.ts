import { createHash } from 'node:crypto';
import { defineConfig, type Plugin } from 'vite';

/**
 * Veiligheidsregel (Content-Security-Policy) voor de gepubliceerde website:
 * `connect-src 'none'` laat de browser elke poging van de app om iets naar het internet te sturen blokkeren.
 * Enkel in de build: de ontwikkelserver heeft een websocket nodig.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'dd-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

/**
 * Service worker voor offline gebruik: bewaart alle bestanden van de app op de tablet.
 * De lijst met bestanden (en dus de cache-versie) wordt bij elke build automatisch opgemaakt.
 */
function serviceWorkerPlugin(): Plugin {
  return {
    name: 'dd-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const all = ['./', ...files.map((f) => `./${f}`), './manifest.webmanifest', './favicon.svg'];
      const version = createHash('sha256').update(all.join('|')).digest('hex').slice(0, 12);
      const sw = `// Draken & Dinges service worker — gegenereerd bij de build. Bewaart de app voor offline gebruik.
const CACHE = 'dd-${version}';
const FILES = ${JSON.stringify(all)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dd-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      if (e.request.mode === 'navigate') return caches.match('./');
      return fetch(e.request);
    }),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
    },
  };
}

export default defineConfig({
  // Relatieve paden: werkt op GitHub Pages in een submap.
  base: './',
  plugins: [cspPlugin(), serviceWorkerPlugin()],
  // Eigen vaste poorten: 5317/5318/5327/5337 zijn al in gebruik door andere projecten
  // (en die kunnen een service worker achterlaten die dan een ander project toont).
  server: { port: 5347, strictPort: true },
  preview: { port: 4347, strictPort: true },
  build: {
    // Oudere Android-tablets kunnen een oudere WebView hebben: conservatief doel.
    target: 'es2018',
    cssTarget: 'chrome61',
    // Geen polyfill die via fetch() laadt (wordt toch geblokkeerd door connect-src 'none').
    modulePreload: { polyfill: false },
  },
});
