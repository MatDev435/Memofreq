// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MAX_MESSAGE_LENGTH, parseClientMessage } from './protocol';

const parse = (value: unknown) => parseClientMessage(JSON.stringify(value));

describe('parseClientMessage', () => {
  it.each(['start-match', 'ready', 'play-again', 'leave'])(
    'aceita %s sem campos e descarta extras',
    (type) => {
      expect(parse({ type, extra: true })).toEqual({ type });
    },
  );

  it.each([
    [{ mode: 'normal' }],
    [{ mode: 'hard' }],
    [{ mode: 'extreme', frequencyCount: 2 }],
    [{ mode: 'extreme', frequencyCount: 3 }],
  ])('aceita a seleção %j', (selection) => {
    expect(parse({ type: 'set-mode', selection })).toEqual({
      type: 'set-mode',
      selection,
    });
  });

  it.each([
    [{ mode: 'extreme' }],
    [{ mode: 'extreme', frequencyCount: 4 }],
    [{ mode: 'insano' }],
    ['normal'],
    [null],
  ])('recusa a seleção %j', (selection) => {
    expect(parse({ type: 'set-mode', selection })).toBeNull();
  });

  it('aceita palpites com índices inteiros e frequência finita', () => {
    expect(
      parse({
        type: 'submit-guess',
        roundIndex: 1,
        attemptIndex: 2,
        frequencyHz: 432.123,
      }),
    ).toEqual({
      type: 'submit-guess',
      roundIndex: 1,
      attemptIndex: 2,
      frequencyHz: 432.123,
    });
  });

  it.each([
    { roundIndex: -1, attemptIndex: 0, frequencyHz: 300 },
    { roundIndex: 0.5, attemptIndex: 0, frequencyHz: 300 },
    { roundIndex: 0, attemptIndex: '0', frequencyHz: 300 },
    { roundIndex: 0, attemptIndex: 0, frequencyHz: '300' },
    { roundIndex: 0, attemptIndex: 0, frequencyHz: null },
    { roundIndex: 0, attemptIndex: 0 },
  ])('recusa palpite malformado %j', (fields) => {
    expect(parse({ type: 'submit-guess', ...fields })).toBeNull();
  });

  it('recusa frequências não finitas escritas como texto JSON', () => {
    expect(
      parseClientMessage(
        '{"type":"submit-guess","roundIndex":0,"attemptIndex":0,"frequencyHz":1e999}',
      ),
    ).toBeNull();
  });

  it('valida perda de round e remoção', () => {
    expect(parse({ type: 'forfeit-round', roundIndex: 3 })).toEqual({
      type: 'forfeit-round',
      roundIndex: 3,
    });
    expect(parse({ type: 'forfeit-round' })).toBeNull();
    expect(parse({ type: 'kick', playerId: 'abc' })).toEqual({
      type: 'kick',
      playerId: 'abc',
    });
    expect(parse({ type: 'kick', playerId: '' })).toBeNull();
    expect(parse({ type: 'kick', playerId: 'x'.repeat(65) })).toBeNull();
  });

  it.each(['', 'ping', '[]', 'null', '{"type":"desconhecido"}', '{bad json'])(
    'recusa conteúdo inválido %j',
    (raw) => {
      expect(parseClientMessage(raw)).toBeNull();
    },
  );

  it('recusa mensagens maiores que o limite', () => {
    const raw = JSON.stringify({
      type: 'ready',
      padding: 'x'.repeat(MAX_MESSAGE_LENGTH),
    });
    expect(parseClientMessage(raw)).toBeNull();
  });
});
