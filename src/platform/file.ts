// Spelbestand naar buiten brengen en terug inlezen.
// Bewaren: via het deelmenu van Android (Drive, WhatsApp, e-mail…) als dat kan, anders als download.

export type ExportResult = 'gedeeld' | 'gedownload' | 'geannuleerd';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function exportTextFile(text: string, fileName: string): Promise<ExportResult> {
  const file = new File([text], fileName, { type: 'text/plain' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Draken & Dinges — spelbestand' });
      return 'gedeeld';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'geannuleerd';
      // Delen lukte niet om een andere reden: val terug op downloaden.
    }
  }
  download(file);
  return 'gedownload';
}

/** Laat de gebruiker een bestand kiezen en geeft de tekst terug (null als er niets gekozen werd). */
export function pickTextFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt,.json,text/plain,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);
    const done = (): void => input.remove();
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      done();
      if (!file) return resolve(null);
      if (file.size > 1_000_000) return reject(new Error('Dit bestand is te groot om een spelbestand te zijn.'));
      file.text().then(resolve, reject);
    });
    input.addEventListener('cancel', () => {
      done();
      resolve(null);
    });
    input.click();
  });
}
