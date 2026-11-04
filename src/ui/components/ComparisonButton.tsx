import { Icon } from './Icon';
import type { ComparisonControl, ComparisonPart } from './useComparisonPart';

export function ComparisonButton({
  control,
  part,
  label,
}: {
  readonly control: ComparisonControl;
  readonly part: ComparisonPart;
  /** Complemento do nome acessível quando há várias tentativas. */
  readonly label: string;
}) {
  const playing = control.playing !== null;
  return (
    <div className="comparison-row">
      <button
        type="button"
        className="secondary comparison-button"
        aria-label={
          playing ? `Parar escuta${label}` : `Ouvir alvo e palpite${label}`
        }
        onClick={playing ? control.onStop : control.onPlay}
      >
        <Icon name={playing ? 'stop' : 'headphones'} />
        <span aria-hidden="true">
          {playing ? 'Parar' : 'Ouvir alvo e palpite'}
        </span>
      </button>
      {playing && (
        <span className="comparison-status" aria-hidden="true">
          {part === 'target'
            ? 'Tocando o alvo…'
            : part === 'player'
              ? 'Tocando seu palpite…'
              : '…'}
        </span>
      )}
    </div>
  );
}
