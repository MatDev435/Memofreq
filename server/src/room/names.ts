export const MAX_NAME_LENGTH = 20;

// Controle e formatação invisível (por exemplo, zero-width) não formam apelidos legíveis.
const INVISIBLE = /[\p{Cc}\p{Cf}]/u;
// O limite conta caracteres percebidos (grafemas), não unidades UTF-16.
const GRAPHEMES = new Intl.Segmenter('pt-BR', { granularity: 'grapheme' });

/** Normaliza o apelido exibido ou retorna `null` quando ele é inválido. */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const length = Array.from(GRAPHEMES.segment(name)).length;
  if (length === 0 || length > MAX_NAME_LENGTH || INVISIBLE.test(name)) {
    return null;
  }
  return name;
}

/** Chave usada para impedir apelidos equivalentes na mesma sala. */
export function nameKey(name: string): string {
  return name.normalize('NFKC').toLocaleLowerCase('pt-BR');
}
