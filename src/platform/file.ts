// Spelbestand naar buiten brengen en terug inlezen.
// Bewaren: de gebruiker kiest zelf: op het toestel (Downloads) of via het deelmenu (Drive, WhatsApp, e-mail…).

export type ExportResult = 'gedeeld' | 'gedownload' | 'geannuleerd';
export type ExportMode = 'share' | 'download';

function textFile(text: string, fileName: string): File {
  return new File([text], fileName, { type: 'text/plain' });
}

/** Kan dit toestel bestanden delen via het deelmenu? (Android/Chrome via https: ja; testen op pc: meestal niet.) */
export function canShareFiles(): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [textFile('test', 'test.txt')] });
}

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

export async function exportTextFile(text: string, fileName: string, mode: ExportMode): Promise<ExportResult> {
  const file = textFile(text, fileName);
  if (mode === 'share' && canShareFiles()) {
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
