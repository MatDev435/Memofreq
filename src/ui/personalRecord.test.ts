import { describe, expect, it } from 'vitest';
import { recordGame } from './personalRecord';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

describe('Recorde pessoal local', () => {
  it('guarda só a melhor pontuação de cada modo', () => {
    const storage = memory();
    expect(recordGame('hard', 'a', 30.5, storage)).toEqual({
      record: { score: 30.5, gameId: 'a' },
      isNew: true,
    });
    expect(recordGame('hard', 'b', 20, storage)).toEqual({
      record: { score: 30.5, gameId: 'a' },
      isNew: false,
    });
    expect(recordGame('hard', 'c', 41.25, storage).isNew).toBe(true);
    expect(recordGame('normal', 'd', 10, storage).record.score).toBe(10);
    expect(storage.data.size).toBe(2);
  });

  it('é idempotente para a mesma partida', () => {
    const storage = memory();
    recordGame('normal', 'a', 25, storage);
    expect(recordGame('normal', 'a', 25, storage).isNew).toBe(true);
  });

  it('empate não substitui o recorde anterior', () => {
    const storage = memory();
    recordGame('normal', 'a', 25, storage);
    expect(recordGame('normal', 'b', 25, storage)).toEqual({
      record: { score: 25, gameId: 'a' },
      isNew: false,
    });
  });

  it('ignora valor corrompido e armazenamento indisponível', () => {
    const storage = memory();
    storage.setItem('memofreq:record:normal', '{oops');
    expect(recordGame('normal', 'a', 5, storage).isNew).toBe(true);
    expect(recordGame('normal', 'b', 50, null)).toEqual({
      record: { score: 50, gameId: 'b' },
      isNew: false,
    });
  });
});
