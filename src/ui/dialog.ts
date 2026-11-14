// Eigen dialoogvenster en meldingsbalk in de stijl van de app (geen grijze browser-popups).

export interface DialogButton {
  label: string;
  value: string;
  primary?: boolean;
}

function el(id: string): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`dialoog-onderdeel ontbreekt: ${id}`);
  return found;
}

/** Toont een vraag met knoppen. Geeft de value van de gekozen knop terug, of null bij Escape. */
export function ask(message: string, buttons: DialogButton[]): Promise<string | null> {
  const backdrop = el('dialog');
  const text = el('dialog-text');
  const row = el('dialog-buttons');
  text.textContent = message;
  row.innerHTML = '';
  for (const b of buttons) {
    const btn = document.createElement('button');
    btn.className = b.primary ? 'btn primary' : 'btn';
    btn.textContent = b.label;
    btn.dataset.value = b.value;
    row.appendChild(btn);
  }
  backdrop.hidden = false;
  const first = row.querySelector<HTMLButtonElement>('.primary') ?? row.querySelector<HTMLButtonElement>('button');
  first?.focus();

  return new Promise((resolve) => {
    const finish = (value: string | null): void => {
      backdrop.hidden = true;
      row.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onClick = (e: Event): void => {
      const target = e.target;
      if (target instanceof HTMLButtonElement && target.dataset.value !== undefined) finish(target.dataset.value);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') finish(null);
    };
    row.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
  });
}

export async function confirmDialog(message: string, okLabel: string, cancelLabel = 'Nee'): Promise<boolean> {
  return (await ask(message, [{ label: cancelLabel, value: 'no' }, { label: okLabel, value: 'yes', primary: true }])) === 'yes';
}

let toastTimer = 0;

/** Korte melding onderaan het scherm. */
export function toast(message: string, kind: 'ok' | 'error' = 'ok'): void {
  const t = el('toast');
  t.textContent = message;
  t.className = kind === 'error' ? 'error' : '';
  t.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    t.hidden = true;
  }, kind === 'error' ? 5000 : 2800);
}
