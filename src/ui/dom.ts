// Kleine DOM-helpers en iconen (inline SVG, werkt offline).

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

export function $(selector: string, scope: ParentNode = document): HTMLElement {
  const el = scope.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`Element ontbreekt: ${selector}`);
  return el;
}

/** Geeft de dichtstbijzijnde knop/element met een data-action terug voor een klik. */
export function actionOf(e: Event): { action: string; id: string; el: HTMLElement } | null {
  const target = e.target;
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>('[data-action]');
  if (!el || el.hasAttribute('disabled')) return null;
  return { action: el.dataset.action ?? '', id: el.dataset.id ?? '', el };
}

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [28, 50], [28, 75], [72, 25], [72, 50], [72, 75]],
};

/** Een dobbelsteenvlak. value 0 = leeg vakje (nog in te vullen). */
export function dieSvg(value: number, cls = ''): string {
  const pips = (PIPS[value] ?? []).map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('');
  return `<svg class="die ${cls}" viewBox="0 0 100 100" aria-label="${value || 'leeg'}"><rect x="5" y="5" width="90" height="90" rx="18"/><g>${pips}</g></svg>`;
}

export const SHIELD_SVG = `<svg class="shield" viewBox="0 0 100 115" aria-hidden="true">
  <path d="M8 8 H92 V52 C92 84 50 108 50 108 C50 108 8 84 8 52 Z" fill="#fff"/>
  <path d="M8 8 H50 V108 C50 108 8 84 8 52 Z" fill="#fef3c7"/>
  <path d="M8 8 H92 V52 C92 84 50 108 50 108 C50 108 8 84 8 52 Z" fill="none" stroke="#1d1a16" stroke-width="4" stroke-linejoin="round"/>
  <path d="M28 40 L33 22 L42 33 L50 18 L58 33 L67 22 L72 40 Z" fill="#fde68a" stroke="#1d1a16" stroke-width="3" stroke-linejoin="round"/>
  <rect x="28" y="40" width="44" height="7" fill="#fde68a" stroke="#1d1a16" stroke-width="3"/>
  <g transform="translate(34 52) scale(0.8)">${fryBagPaths()}</g>
</svg>`;

function fryBagPaths(): string {
  return `<g fill="#fde68a" stroke="#1d1a16" stroke-width="2" stroke-linejoin="round">
    <rect x="9" y="4" width="5" height="22" rx="2" transform="rotate(-12 11 15)"/>
    <rect x="15" y="1" width="5" height="24" rx="2"/>
    <rect x="21" y="3" width="5" height="22" rx="2" transform="rotate(6 23 14)"/>
    <rect x="27" y="6" width="5" height="20" rx="2" transform="rotate(16 29 16)"/>
  </g>
  <path d="M5 18 H35 L24 48 H16 Z" fill="#fff" stroke="#1d1a16" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M9 24 H31" stroke="#c2410c" stroke-width="2"/>`;
}

export const FRY_BAG_SVG = `<svg class="ico fry-bag" viewBox="0 0 40 50" aria-hidden="true">${fryBagPaths()}</svg>`;

/** Eén frietje: vol (nog te eten) of leeg (opgegeten). */
export function frySvg(full: boolean): string {
  return `<svg class="fry ${full ? 'full' : 'eaten'}" viewBox="0 0 12 40" aria-hidden="true"><rect x="1.5" y="1.5" width="9" height="37" rx="3.5"/></svg>`;
}

export const DICE_ICON = `<svg class="ico" viewBox="0 0 40 40" aria-hidden="true"><rect x="4" y="4" width="32" height="32" rx="7" fill="none" stroke="currentColor" stroke-width="3"/><g fill="currentColor"><circle cx="13" cy="13" r="3.2"/><circle cx="27" cy="13" r="3.2"/><circle cx="20" cy="20" r="3.2"/><circle cx="13" cy="27" r="3.2"/><circle cx="27" cy="27" r="3.2"/></g></svg>`;

/** De Pruttelpot: het orakel van Kakofonië (een toverpot met een gezicht en borrelende bubbels). */
export const POT_SVG = `<svg class="pot" viewBox="0 0 120 112" aria-hidden="true">
  <g class="bubbles" fill="#bef264" stroke="#1d1a16" stroke-width="2.5">
    <circle class="b1" cx="44" cy="28" r="6"/><circle class="b2" cx="62" cy="18" r="8"/><circle class="b3" cx="80" cy="30" r="5"/>
  </g>
  <path d="M8 58 C0 58 0 74 12 72" fill="none" stroke="#1d1a16" stroke-width="5" stroke-linecap="round"/>
  <path d="M112 58 C120 58 120 74 108 72" fill="none" stroke="#1d1a16" stroke-width="5" stroke-linecap="round"/>
  <path d="M14 48 C14 94 30 106 60 106 C90 106 106 94 106 48 Z" fill="#57534e" stroke="#1d1a16" stroke-width="4" stroke-linejoin="round"/>
  <rect x="7" y="40" width="106" height="11" rx="5.5" fill="#78716c" stroke="#1d1a16" stroke-width="4"/>
  <ellipse cx="60" cy="41" rx="46" ry="5" fill="#a3e635"/>
  <g class="eyes"><circle cx="45" cy="70" r="8.5" fill="#fff"/><circle cx="75" cy="70" r="8.5" fill="#fff"/>
  <circle cx="47" cy="72" r="3.8" fill="#1d1a16"/><circle cx="77" cy="72" r="3.8" fill="#1d1a16"/></g>
  <path d="M50 88 Q60 96 70 88" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>
</svg>`;

export const BOLT_ICON = `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 L4 14 H11 L10 22 L20 9 H13 Z" fill="#fde68a" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
