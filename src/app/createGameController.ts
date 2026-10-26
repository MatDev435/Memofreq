import { GameController } from '../application/GameController';
import { WebAudioEngine } from '../audio/WebAudioEngine';
import { AUDIO_SETTINGS } from '../audio/config';
import { DEFAULT_RULES } from '../domain/config';

export function createBrowserGameController(): GameController {
  return new GameController({
    createAudio: (onInterruption) =>
      new WebAudioEngine({ range: DEFAULT_RULES.range, onInterruption }),
    initialVolume: AUDIO_SETTINGS.initialVolume,
    isPageVisible: () => document.visibilityState !== 'hidden',
    random: () => {
      const value = crypto.getRandomValues(new Uint32Array(1))[0];
      if (value === undefined) throw new Error('Sorteio indisponível.');
      return value / 2 ** 32;
    },
    createId: () =>
      Array.from(crypto.getRandomValues(new Uint32Array(4)), (value) =>
        value.toString(16).padStart(8, '0'),
      ).join(''),
  });
}
