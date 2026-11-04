import { useUiFeedback } from '../feedback/uiFeedbackContext';
import { Icon } from './Icon';

/** Liga e desliga efeitos sonoros e vibração da interface (não afeta os tons do jogo). */
export function SoundToggle() {
  const { soundsEnabled, toggleSounds } = useUiFeedback();
  return (
    <button
      type="button"
      className="motion-toggle sound-toggle"
      aria-label="Efeitos sonoros e vibração"
      aria-pressed={soundsEnabled}
      title={
        soundsEnabled
          ? 'Desativar efeitos sonoros e vibração'
          : 'Ativar efeitos sonoros e vibração'
      }
      onClick={toggleSounds}
    >
      <Icon name="sparkle" />
    </button>
  );
}
