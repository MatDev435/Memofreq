import type { RandomSource } from '../../src/domain/frequencies';

/** Base32 de Crockford: sem I, L, O e U, evitando confusões ao digitar. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ROOM_CODE_LENGTH = 10;
const ROOM_CODE = new RegExp(`^[${ALPHABET}]{${String(ROOM_CODE_LENGTH)}}$`);

type RandomBytes = (length: number) => Uint8Array;

const cryptoBytes: RandomBytes = (length) =>
  crypto.getRandomValues(new Uint8Array(length));

/** Código de sala com 50 bits aleatórios (32¹⁰ combinações). */
export function generateRoomCode(randomBytes = cryptoBytes): string {
  // 256 é múltiplo de 32: o resto preserva a distribuição uniforme.
  return Array.from(
    randomBytes(ROOM_CODE_LENGTH),
    (byte) => ALPHABET[byte % ALPHABET.length],
  ).join('');
}

/** Aceita minúsculas, espaços e hífens digitados pelo jogador. */
export function normalizeRoomCode(raw: string): string | null {
  const code = raw.replace(/[\s-]/gu, '').toUpperCase();
  return ROOM_CODE.test(code) ? code : null;
}

export function createPlayerId(randomBytes = cryptoBytes): string {
  return Array.from(randomBytes(8), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

/** Mesma estratégia da aplicação web: 32 bits do CSPRNG em [0, 1). */
export const cryptoRandom: RandomSource = () => {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  if (value === undefined) throw new Error('Sorteio indisponível.');
  return value / 2 ** 32;
};
