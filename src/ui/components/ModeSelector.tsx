import type { ModeSelection } from '../../domain/config';
import { Icon } from './Icon';
import { WaveArt } from './WaveArt';
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
    <section className="mode-section" aria-labelledby="mode-heading">
      <div className="mode-heading">
        <h2 id="mode-heading">
          <Icon name="gamepad" />
          Modo de jogo
        </h2>
        <p>Escolha o nível de dificuldade que mais combina com você.</p>
      </div>
      <div className="mode-layout">
        <fieldset className="mode-selection">
          <legend className="sr-only">Modo de jogo</legend>
          {(
            [
              [
                'normal',
                'Normal',
                'Uma referência de 3 segundos.',
                'Frequência visível.',
                '3 s',
              ],
              [
                'hard',
                'Hard',
                'Uma referência de 1,5 segundo.',
                'Frequência oculta.',
                '1,5 s',
              ],
              [
                'extreme',
                'Extreme',
                'Memorize uma sequência de frequências',
                'e responda na mesma ordem.',
                '1,5 s (por tom)',
              ],
            ] as const
          ).map(([value, label, description, detail, time]) => (
            <label
              key={value}
              className={`mode-card mode-${value}`}
              data-selected={mode === value}
            >
              <input
                type="radio"
                name="mode"
                value={value}
                checked={mode === value}
                onChange={() => {
                  onMode(value);
                }}
              />
              <Icon name="bars" className="mode-symbol" />
              {value !== 'normal' && (
                <WaveArt variant="mini" className="mode-wave" />
              )}
              <span className="mode-copy">
                <strong>{label}</strong>
                <span>
                  {description}
                  <br />
                  {detail}
                </span>
              </span>
              {value === 'normal' && (
                <span className="recommended" aria-hidden="true">
                  Recomendado
                </span>
              )}
              <span className="mode-facts">
                <span>
                  <Icon name="clock" />
                  Tempo de referência: {time}
                </span>
                <span>
                  <Icon name={value === 'normal' ? 'eye' : 'hidden'} />
                  {value === 'normal'
                    ? 'Frequência visível'
                    : value === 'hard'
                      ? 'Frequência oculta'
                      : 'Sequência de frequências'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset
          className="frequency-selection"
          disabled={mode !== 'extreme'}
          aria-describedby="frequency-note"
        >
          <legend className="sr-only">Referências por round</legend>
          <div className="frequency-heading">
            <Icon name="target" />
            <div>
              <h3>Referências por round</h3>
              <p>
                Escolha quantas frequências serão apresentadas em cada round no
                modo Extreme.
              </p>
            </div>
          </div>
          <div className="frequency-options">
            {([2, 3] as const).map((count) => (
              <label key={count} data-selected={frequencyCount === count}>
                <input
                  type="radio"
                  name="frequency-count"
                  value={count}
                  checked={frequencyCount === count}
                  onChange={() => {
                    onFrequencyCount(count);
                  }}
                />
                <span>{count} frequências</span>
                <span className="frequency-symbols" aria-hidden="true">
                  {Array.from({ length: count }, (_, i) => (
                    <Icon key={i} name="bars" />
                  ))}
                </span>
              </label>
            ))}
          </div>
          <p id="frequency-note">
            {mode === 'extreme'
              ? 'A quantidade permanece fixa nos cinco rounds.'
              : 'Disponível no modo Extreme. A quantidade fica fixa nos cinco rounds.'}
          </p>
        </fieldset>
      </div>
    </section>
  );
}
