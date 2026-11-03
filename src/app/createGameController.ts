import { GameController } from '../application/GameController';
import { MultiplayerController } from '../application/MultiplayerController';
import type { AudioInterruption } from '../application/audioPort';
import { MULTIPLAYER_URL } from '../multiplayer/config';
import { WebAudioEngine } from '../audio/WebAudioEngine';
import { AUDIO_SETTINGS } from '../audio/config';
import { DEFAULT_RULES } from '../domain/config';

function createBrowserAudio(
  onInterruption: (event: AudioInterruption) => void,
): WebAudioEngine {
  return new WebAudioEngine({ range: DEFAULT_RULES.range, onInterruption });
}

const isPageVisible = () => document.visibilityState !== 'hidden';

export function createBrowserMultiplayerController(
  initialVolume: number = AUDIO_SETTINGS.initialVolume,
): MultiplayerController {
  return new MultiplayerController({
    url: MULTIPLAYER_URL,
    createAudio: createBrowserAudio,
    initialVolume,
    isPageVisible,
  });
}

export function createBrowserGameController(): GameController {
  return new GameController({
    createAudio: createBrowserAudio,
    initialVolume: AUDIO_SETTINGS.initialVolume,
    isPageVisible,
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
