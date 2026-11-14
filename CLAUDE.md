# Draken & Dinges — instructies voor Claude

## Wat is dit?
Een familie-rollenspel zonder spelleider voor een dochter (10), papa en mama (1–6 spelers).
De tablet-app is de verteller; niemand aan tafel kent het verhaal. Land: **Kakofonië**, hoofdstad **Scheetegem**.

## Hoe verder gaan in een nieuwe sessie
1. Lees **[docs/BOUWPLAN.md](docs/BOUWPLAN.md)**: de bron van waarheid (beslissingen, regels, wereld, bouwblokken + status).
2. Zoek het eerste blok dat niet ✅ is. Toon eerst wat je gaat bouwen en wacht op een expliciete "go".
3. Eén blok per keer, laat de gebruiker testen, pas daarna verder.
4. Na elk blok: status in `BOUWPLAN.md` bijwerken; gebruikersfuncties gewijzigd → ook `docs/HANDLEIDING.md`.

## Harde eisen (nooit van afwijken)
- **SPOILERS**: papa speelt zelf mee. Echte verhaalinhoud (slechteriken, plannen, scènes, geheimen) schrijf je
  **altijd via een sub-agent** en toon je **nooit** in de chat, in commitberichten of in samenvattingen.
  Bouw en test met saaie placeholder-inhoud. Wereldnamen (Kakofonië, Scheetegem…) zijn géén spoilers.
- **Werkwijze verborgen inhoud**: sub-agent schrijft JSON naar een map BUITEN de repo (scratchpad) →
  `node scripts/encode-content.mjs <json> <naam>` → `src/content/<naam>.data.ts` (base64) → leesbare JSON verwijderen.
  Nooit `*.data.ts` decoderen, tonen of in screenshots vastleggen; tests controleren enkel vorm en aantallen.
  Toegang in code via `src/content/index.ts` (Eidastinkt, voorwerpen), `src/content/season-view.ts` (seizoenen) en
  `src/content/adventure-view.ts` (losse avonturen; vorm controleren met `node scripts/check-adventures.mjs <json>`).
  `beginscenes.data.ts` wordt niet meer gebruikt (vervangen door de losse avonturen).
  Vorm van de seizoensinhoud: `src/content/season-content.ts` (vertakt: begin → wending gelukt/mislukt → moment
  gelukt/mislukt; elke scène heeft een doel, 8–10 acties met eigen gevolgen en een afloop gelukt/mislukt); vorm controleren zonder inhoud te tonen: `node scripts/check-seasons.mjs <json>`.
  **Verhaalinhoud altijd laten nalezen door een sub-agent die ze niet schreef** (samenhang over alle paden, plotgaten),
  dan verbeteren en opnieuw nalezen; bevindingen enkel in geheime bestanden, aan de hoofdsessie enkel aantallen. `seizoenen.data.ts` bevat het **echte verhaal** (3 slechteriken);
  testinhoud (`test: true`, toont TESTVERHAAL) kan voor ontwikkeling tijdelijk in dezelfde vorm, maar nooit committen.
- Elke verhaaltekst in de UI krijgt class `story-text`: de browsertest maakt die wazig in screenshots.
- **Geen AI** in de app, **alles gratis**, werkt **offline**. CSP `connect-src 'none'` in de build nooit verwijderen.
- Bewaren = **spelbestand** (deelmenu Android / download) met versienummer; de browser-kopie is enkel een vangnet.
  Formaat wijzigen → `SAVE_VERSION` verhogen en een stap toevoegen in `migrate()` (oude bestanden moeten blijven werken).
- Humor: herkenbaar Vlaams voor een meisje van 10 (tussen verkavelingsvlaams en dialect), absurd/slapstick/woordgrapjes,
  wc-humor **subtiel** verstopt in namen. Gezond spannend, nooit echt eng.
- Regels blijven minimaal (zie BOUWPLAN §2). Kernregel = gewone D6; D&D-dobbelstenen enkel optioneel.
- Ideeënlijsten staan op twee plaatsen: `src/data/ideas.ts` en `public/print/regelkaart.html` — samen aanpassen
  (ook de eerste 6 van pech/opdrachten/prikkels in `src/data/`).
- Oude Android-WebViews: geen flex-`gap`, geen `:has()` (grid-gap mag).
- Nooit pushen of een repo aanmaken zonder akkoord van de gebruiker.

## Architectuur
- Vite + TypeScript (strict, geen `any`), zelfde opzet als SingApp. Offline PWA (`vite.config.ts` maakt `sw.js` + CSP).
- `src/main.ts` — controller (open spel, schermwissel, bewaren). `src/app.ts` — gedeelde types + bovenbalk.
- `src/game/` — pure spellogica met tests: `state.ts` (helden, sessies, beurt, frietjes), `dice.ts` (dobbelregels),
  `save.ts` (spelbestand + controle + migratie).
- `src/screens/` — `home`, `heroes`, `editor` (aanmaakscherm), `table` (speeltafel), `dice` (dobbelvenster, ook groepsworp),
  `oracle` (Pruttelpot, prikkel, Eidastinkt), `season` (meter, hoofdstuk, beslissend moment, finale).
- `src/game/season.ts` — seizoensregels (pure functies + tests).
- `src/platform/file.ts` — delen/downloaden/inlezen. `src/storage/autosave.ts` — reservekopie in localStorage.
- `src/ui/` — `dom.ts` (helpers + SVG-iconen), `dialog.ts` (eigen dialoog + meldingen).
- `public/print/` — printbare regelkaart en heldenblad (gelinkt op het startscherm, eigen lettertypes in `public/print/fonts`, offline).
- `public/icons/` — app-icoontjes, opnieuw maken met `node scripts/make-icons.mjs`.

## Commando's
- `npm run dev` — ontwikkelserver op http://localhost:5347 (ook bereikbaar op het lokale netwerk)
- `npm run build` — typecheck + productiebuild naar `dist/`
- `npm test` — unit-tests spellogica (Vitest)
- `npm run e2e` / `npm run e2e:prod` — klikt het hele spel door in Edge/Chrome, screenshots in `e2e-output/`

## Conventies
- Commits volgens Conventional Commits (`feat:`, `fix:`, `docs:`, …). Code-commentaar en UI-teksten in het Nederlands.
