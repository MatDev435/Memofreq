import { Icon } from './Icon';
export function KeyboardHints({
  compact = false,
}: {
  readonly compact?: boolean;
}) {
  return (
    <div className={`keyboard-hints${compact ? ' is-compact' : ''}`}>
      <div className="keyboard-title">
        <Icon name="keyboard" />
        <span>{compact ? 'Outros controles' : 'Dicas de controles'}</span>
      </div>
      {!compact && (
        <p>
          Durante a tentativa, use as setas ou os botões para ajustar o tom.
        </p>
      )}
      <div className="keyboard-keys">
        {!compact && (
          <span>
            <kbd>←</kbd> <kbd>→</kbd> <small>Ajuste fino</small>
          </span>
        )}
        <span>
          <kbd>Page Up</kbd>
          <small>{compact ? '(ajuste maior)' : ''}</small>
        </span>
        <span>
          <kbd>Page Down</kbd>
          <small>{compact ? '(ajuste maior)' : 'Ajuste maior'}</small>
        </span>
        <span>
          <kbd>Home</kbd>
          <small>{compact ? '(mínimo)' : 'Início'}</small>
        </span>
        <span>
          <kbd>End</kbd>
          <small>{compact ? '(máximo)' : 'Máximo'}</small>
        </span>
      </div>
    </div>
  );
}
