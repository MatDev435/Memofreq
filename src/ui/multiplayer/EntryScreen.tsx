import { useEffect, useRef, useState } from 'react';
import type { Ref, SyntheticEvent } from 'react';
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from '../../multiplayer/protocol';
import { Icon } from '../components/Icon';
import { WaveArt } from '../components/WaveArt';

export type EntryErrorField = 'name' | 'code' | null;

export function EntryScreen({
  inviteCode,
  error,
  errorField,
  connecting,
  headingRef,
  onCreate,
  onJoin,
}: {
  readonly inviteCode: string | null;
  readonly error: string | null;
  readonly errorField: EntryErrorField;
  readonly connecting: boolean;
  readonly headingRef: Ref<HTMLHeadingElement>;
  readonly onCreate: (name: string) => void;
  readonly onJoin: (code: string, name: string) => void;
}) {
  const [name, setName] = useState('');
  const [code, setCode] = useState(inviteCode ?? '');
  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const invited = inviteCode !== null;

  useEffect(() => {
    if (error === null) return;
    if (errorField === 'name') nameRef.current?.focus();
    else if (errorField === 'code') codeRef.current?.focus();
  }, [error, errorField]);

  const join = () => {
    onJoin(code, name);
  };
  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    if (invited) join();
    else onCreate(name);
  };
  const described = (field: Exclude<EntryErrorField, null>, hint: string) =>
    error !== null && errorField === field ? `${hint} mp-entry-error` : hint;

  return (
    <section
      className="mp-screen mp-entry screen-enter"
      aria-labelledby="mp-entry-title"
    >
      <div className="mp-intro">
        <div>
          <p className="eyebrow">Multiplayer</p>
          <h2 id="mp-entry-title" ref={headingRef} tabIndex={-1}>
            {invited ? 'Convite para uma sala' : 'Jogue com amigos'}
          </h2>
          <p>
            {invited
              ? `Escolha seu apelido para entrar na sala ${inviteCode}.`
              : 'Escolha um apelido e crie uma sala privada ou entre com o código recebido.'}
          </p>
        </div>
        <WaveArt variant="hero" />
      </div>
      {error && (
        <p id="mp-entry-error" className="error-message" role="alert">
          {error}
        </p>
      )}
      <form className="mp-entry-form" onSubmit={submit} noValidate>
        <div className="mp-panel mp-name-panel">
          <label htmlFor="mp-name">Seu apelido</label>
          <input
            ref={nameRef}
            id="mp-name"
            type="text"
            autoComplete="nickname"
            maxLength={MAX_NAME_LENGTH * 2}
            value={name}
            aria-invalid={errorField === 'name' && error !== null}
            aria-describedby={described('name', 'mp-name-hint')}
            onChange={(event) => {
              setName(event.currentTarget.value);
            }}
          />
          <p id="mp-name-hint" className="mp-note">
            De 1 a {MAX_NAME_LENGTH} caracteres. Ele aparece para os outros
            participantes da sala.
          </p>
        </div>
        <div className={`mp-entry-options${invited ? ' is-invited' : ''}`}>
          <section
            className="mp-panel mp-option"
            aria-labelledby="mp-join-title"
          >
            <h3 id="mp-join-title">
              <Icon name="link" />
              Entrar em uma sala
            </h3>
            <label htmlFor="mp-code">Código da sala</label>
            <input
              ref={codeRef}
              id="mp-code"
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={ROOM_CODE_LENGTH + 4}
              value={code}
              aria-invalid={errorField === 'code' && error !== null}
              aria-describedby={described('code', 'mp-code-hint')}
              onChange={(event) => {
                setCode(event.currentTarget.value);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                join();
              }}
            />
            <p id="mp-code-hint" className="mp-note">
              {ROOM_CODE_LENGTH} caracteres, como no link de convite.
            </p>
            <button
              type={invited ? 'submit' : 'button'}
              className={invited ? 'primary' : 'secondary'}
              disabled={connecting}
              onClick={invited ? undefined : join}
            >
              <Icon name="arrow" />
              Entrar na sala
            </button>
          </section>
          <section
            className="mp-panel mp-option"
            aria-labelledby="mp-create-title"
          >
            <h3 id="mp-create-title">
              <Icon name="crown" />
              Criar uma sala
            </h3>
            <p>
              Você será o host: escolhe o modo, inicia a partida e pode remover
              participantes.
            </p>
            <button
              type={invited ? 'button' : 'submit'}
              className={invited ? 'secondary' : 'primary'}
              disabled={connecting}
              onClick={
                invited
                  ? () => {
                      onCreate(name);
                    }
                  : undefined
              }
            >
              <Icon name="users" />
              {invited ? 'Criar outra sala' : 'Criar sala'}
            </button>
          </section>
        </div>
      </form>
      <p className="mp-connecting" role="status">
        {connecting ? 'Conectando à sala…' : ''}
      </p>
    </section>
  );
}
