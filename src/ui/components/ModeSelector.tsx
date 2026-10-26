import type { ModeSelection } from '../../domain/config';

export function ModeSelector({
  mode,
  frequencyCount,
  onMode,
  onFrequencyCount,
}: {
  readonly mode: ModeSelection['mode'];
  readonly frequencyCount: 2 | 3;
  readonly onMode: (mode: ModeSelection['mode']) => void;
  readonly onFrequencyCount: (count: 2 | 3) => void;
}) {
  return (
    <>
      <fieldset className="mode-selection">
        <legend>Modo de jogo</legend>
        {(
          [
            ['normal', 'Normal', 'Uma referência de 3 s. Frequência visível.'],
            ['hard', 'Hard', 'Uma referência de 1,5 s. Frequência oculta.'],
            [
              'extreme',
              'Extreme',
              'Memorize a sequência e responda na mesma ordem.',
            ],
          ] as const
        ).map(([value, label, description]) => (
          <label key={value}>
            <input
              type="radio"
              name="mode"
              value={value}
              checked={mode === value}
              onChange={() => {
                onMode(value);
              }}
            />
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
          </label>
        ))}
      </fieldset>
      {mode === 'extreme' && (
        <fieldset className="mode-selection">
          <legend>Referências por round</legend>
          {([2, 3] as const).map((count) => (
            <label key={count}>
              <input
                type="radio"
                name="frequency-count"
                value={count}
                checked={frequencyCount === count}
                onChange={() => {
                  onFrequencyCount(count);
                }}
              />
              {count} frequências
            </label>
          ))}
          <p className="muted">A quantidade permanece fixa nos cinco rounds.</p>
        </fieldset>
      )}
      <p className="muted">5 rounds por partida · até 50 pontos</p>
    </>
  );
}
