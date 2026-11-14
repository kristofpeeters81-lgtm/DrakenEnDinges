// Verborgen inhoud (spoilers) staat licht gecodeerd in de broncode, zodat papa ze niet per ongeluk leest
// bij het bouwen of testen. Geen beveiliging, enkel "niet per ongeluk zien". Coderen: scripts/encode-content.mjs.

/** Decodeert base64 (UTF-8 JSON) en controleert de vorm met `guard`. */
export function decodeContent<T>(encoded: string, guard: (v: unknown) => v is T): T {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!guard(value)) throw new Error('Verborgen inhoud heeft een onverwachte vorm');
  return value;
}

export function isStringList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string' && s.trim().length > 0);
}
