import { useUiFeedback } from '../feedback/uiFeedbackContext';
import { Icon } from './Icon';

/** Liga e desliga os efeitos sonoros da interface (não afeta os tons do jogo). */
export function SoundToggle() {
  const { soundsEnabled, toggleSounds } = useUiFeedback();
  return (
    <button
      type="button"
      className="motion-toggle sound-toggle"
      aria-label="Efeitos sonoros"
      aria-pressed={soundsEnabled}
      title={
        soundsEnabled ? 'Desativar efeitos sonoros' : 'Ativar efeitos sonoros'
      }
      onClick={toggleSounds}
    >
      <Icon name="sparkle" />
    </button>
  );
}
