// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  createPlayerId,
  cryptoRandom,
  generateRoomCode,
  normalizeRoomCode,
  ROOM_CODE_LENGTH,
} from './codes';
import { isAllowedOrigin } from './origin';

describe('códigos de sala', () => {
  it('gera dez caracteres do alfabeto de Crockford', () => {
    for (let index = 0; index < 200; index += 1) {
      const code = generateRoomCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
      expect(normalizeRoomCode(code)).toBe(code);
    }
  });

  it('usa cada byte de forma uniforme no alfabeto', () => {
    const bytes = Uint8Array.from(
      { length: ROOM_CODE_LENGTH },
      (_, i) => i * 32 + 31,
    );
    expect(generateRoomCode(() => bytes)).toBe('ZZZZZZZZZZ');
    expect(generateRoomCode(() => new Uint8Array(ROOM_CODE_LENGTH))).toBe(
      '0000000000',
    );
  });

  it('normaliza minúsculas, espaços e hífens', () => {
    expect(normalizeRoomCode(' abcde-fghjk ')).toBe('ABCDEFGHJK');
  });

  it.each([
    '',
    'ABCDEFGHJ',
    'ABCDEFGHJKM',
    'ABCDEFGHJI',
    'ABCDEFGHJ%',
    'ÁBCDEFGHJK',
  ])('recusa o código %j', (code) => {
    expect(normalizeRoomCode(code)).toBeNull();
  });

  it('gera IDs de participante e sorteios no intervalo esperado', () => {
    expect(createPlayerId()).toMatch(/^[0-9a-f]{16}$/);
    for (let index = 0; index < 100; index += 1) {
      const value = cryptoRandom();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('origens permitidas', () => {
  const allowed = 'https://memofreq.vercel.app, http://localhost:5173,';

  it('aceita somente origens exatas da lista', () => {
    expect(isAllowedOrigin('https://memofreq.vercel.app', allowed)).toBe(true);
    expect(isAllowedOrigin('http://localhost:5173', allowed)).toBe(true);
    expect(
      isAllowedOrigin('https://memofreq.vercel.app.evil.test', allowed),
    ).toBe(false);
    expect(isAllowedOrigin('http://localhost:5174', allowed)).toBe(false);
    expect(isAllowedOrigin('', allowed)).toBe(false);
    expect(isAllowedOrigin(null, allowed)).toBe(false);
  });
});
