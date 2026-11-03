# Protocolo WebSocket do multiplayer

Versão do protocolo: **1**. Tipos de referência: `server/src/protocol.ts`. O servidor é autoritativo: o cliente envia intenções, e o estado publicado pela sala é sempre a fonte de verdade.

## Conexão

| Ação         | URL                                                                     |
| ------------ | ----------------------------------------------------------------------- |
| Criar sala   | `wss://<backend>/rooms?name=<apelido>`                                  |
| Entrar       | `wss://<backend>/rooms/<código>?name=<apelido>`                         |
| Saúde (HTTP) | `GET https://<backend>/health` → `{ "ok": true, "protocolVersion": 1 }` |

- Em desenvolvimento local, `<backend>` é `127.0.0.1:8787` com `ws://` e `http://`.
- O apelido vai codificado com `encodeURIComponent`. Ele é normalizado (NFC, espaços colapsados e aparados) e deve ter de 1 a 20 grafemas, sem caracteres de controle ou invisíveis. Apelidos equivalentes, ignorando maiúsculas e variantes de largura, são recusados na mesma sala.
- O código tem 10 caracteres do Base32 de Crockford (`0-9`, `A-Z` sem `I`, `L`, `O`, `U`). Minúsculas, espaços e hífens são aceitos na entrada. O frontend usa o link de convite `https://memofreq.vercel.app/#sala=<código>` (mesma página, fragmento sem rotas).
- O upgrade exige um cabeçalho `Origin` presente em `ALLOWED_ORIGINS` (`server/wrangler.jsonc`). Origens fora da lista recebem HTTP 403. Requisições sem upgrade recebem 426.
- Uma entrada recusada (sala inexistente, em partida, cheia, apelido inválido ou repetido) completa o upgrade, envia um `error` com `fatal: true` e fecha com o código 4000. Navegadores não expõem o status HTTP de um upgrade recusado.
- Não há reconexão nem recuperação de sessão. Recarregar a página ou perder a conexão remove o participante. Durante uma partida, ele só volta quando a sala retornar ao lobby, como novo participante.

### Ping

Envie o texto `ping` (fora de JSON) a cada **25 s**. O runtime responde `pong` sem acordar a sala. Sem ping nem outra mensagem por mais de 75 s, a sala considera a conexão morta: envia `error` `inactive`, fecha com 4002 e remove o participante. A verificação roda a cada 30 s, então a remoção acontece entre 75 e 105 s após o último sinal.

### Erros fatais

Ao receber `error` com `fatal: true`, o cliente deve se considerar fora da sala e fechar o WebSocket. O fechamento iniciado pelo servidor pode chegar alguns segundos depois. No `workerd` local, observamos cerca de 10 s quando a sala fecha outra conexão, como na remoção pelo host. A remoção no estado é imediata.

## Cliente → servidor

Mensagens JSON com até 2048 caracteres. Mais de 30 mensagens JSON em 10 s fazem a sala enviar `rate-limited`, fechar com 4003 e remover o participante. O ping não conta.

| `type`          | Campos                                      | Quem  | Fase                     |
| --------------- | ------------------------------------------- | ----- | ------------------------ |
| `set-mode`      | `selection`                                 | host  | `lobby`                  |
| `start-match`   | —                                           | host  | `lobby`                  |
| `ready`         | —                                           | todos | `ready`, `round-results` |
| `submit-guess`  | `roundIndex`, `attemptIndex`, `frequencyHz` | todos | `playing`                |
| `forfeit-round` | `roundIndex`                                | todos | `playing`                |
| `kick`          | `playerId`                                  | host  | qualquer                 |
| `play-again`    | —                                           | host  | `final`                  |
| `leave`         | —                                           | todos | qualquer                 |

`selection` é `{ "mode": "normal" }`, `{ "mode": "hard" }` ou `{ "mode": "extreme", "frequencyCount": 2 | 3 }`.

- **`submit-guess`:** envia um palpite em Hz, com a precisão do slider, na faixa da partida (80–700 Hz). Os índices começam em zero. Cada tentativa é aceita uma única vez e em ordem. No Extreme, envie um palpite a cada confirmação intermediária. O round do jogador termina quando todas as tentativas foram recebidas. O cliente nunca envia pontuação.
- **`forfeit-round`:** o cliente informa que perdeu o round por uma interrupção local (aba oculta, falha de áudio). O round inteiro vale zero, palpites parciais são descartados e a partida continua no round seguinte. Essa regra existe apenas no multiplayer.
- **`ready` repetido** não tem efeito.
- **`leave`** remove o participante e fecha com 1000.

## Servidor → cliente

```ts
type ServerMessage =
  | { type: 'welcome'; protocolVersion: 1; playerId: string }
  | { type: 'room'; room: RoomView }
  | { type: 'error'; code: ErrorCode; fatal: boolean; request?: string };
```

- `welcome` chega uma vez, antes do primeiro `room`, com o ID do próprio participante.
- `room` é publicado a todos a cada mudança, com o estado completo e igual para todos. `version` cresce a cada mudança.
- `error` não fatal responde a um comando recusado, com `request` indicando o `type` original. O estado não muda.

### `RoomView`

```ts
interface RoomView {
  code: string;
  version: number;
  phase: 'lobby' | 'ready' | 'playing' | 'round-results' | 'final';
  hostId: string;
  maxPlayers: 8;
  selection: ModeSelection;
  players: { id: string; name: string }[]; // ordem de entrada
  match: MatchView | null; // null no lobby
}

interface MatchView {
  modality: 'normal' | 'hard' | 'extreme-2' | 'extreme-3';
  settings: ModeSettings; // referências por round, duração, Hz visível
  rules: GameRules; // faixa, contagem, pausa, distâncias
  roundIndex: number; // 0 a 4
  roundCount: 5;
  readyIds: string[]; // em ready e round-results
  progress: {
    playerId: string;
    status: 'playing' | 'completed' | 'forfeited';
    attemptsSubmitted: number;
  }[]; // somente em playing, sem valores
  currentRound: {
    roundIndex: number;
    references: number[]; // alvos do round vigente, em ordem
    initialFrequencies: number[]; // posição inicial de cada tentativa
  } | null; // somente em playing
  lastRound: RoundResultsView | null; // em round-results e final
  ranking: RankingEntry[] | null; // somente em final
  rounds: RoundResultsView[] | null; // somente em final, os cinco rounds
}

interface RoundResultsView {
  roundIndex: number;
  references: number[];
  players: {
    playerId: string;
    name: string;
    status: 'completed' | 'forfeited';
    score: number; // média do round; zero se perdido
    attempts: AttemptResult[]; // alvo, palpite, diferença, cents e nota
  }[];
}

interface RankingEntry {
  position: number;
  playerId: string;
  name: string;
  totalScore: number; // 0 a 50
  roundScores: number[]; // cinco notas
}
```

Valores numéricos seguem a precisão interna do domínio. O frontend arredonda apenas na apresentação.

**Visibilidade:**

- Rounds futuros nunca são enviados.
- Durante `playing`, nenhum palpite, nota ou resultado aparece: apenas o status e a quantidade de tentativas enviadas por cada participante.
- Os palpites de todos aparecem juntos em `lastRound`, quando o round termina.
- Participantes removidos deixam de aparecer em resultados posteriores, inclusive em `rounds` e `ranking`.

## Fases e transições

```text
lobby ──start-match (host)──► ready ──todos ready──► playing (round 0)
playing ──todos concluíram ou perderam──► round-results   (rounds 0 a 3)
playing ──último round concluído──► final
round-results ──todos ready──► playing (round seguinte)
final ──play-again (host)──► lobby   (partida descartada; entradas liberadas)
qualquer fase ──último participante sai──► sala encerrada (código invalidado)
```

- Só `lobby` aceita novas entradas. Nas demais fases, a resposta é `room-in-match`.
- "Todos" significa os participantes atuais. Saídas, desconexões e remoções pelo host reavaliam a condição na hora, e o round ou a prontidão podem avançar com elas.
- Em `final`, a sala permanece até o host enviar `play-again` ou todos saírem. O último round aparece em `lastRound` e o resumo completo em `rounds`.
- Se o host sair, o participante mais antigo restante (primeiro em `players`) assume. Com um único participante, a partida continua normalmente.
- Não há limite de tempo. O host pode remover participantes parados com `kick`.

**Ranking:** soma dos cinco rounds, com round perdido valendo zero. Empates exatos, na precisão interna, compartilham a posição, como na competição padrão (1, 1, 3). Dentro do empate, a ordem segue a ordem de entrada na sala.

## Códigos de erro

| Código              | Quando                                                      | Fatal |
| ------------------- | ----------------------------------------------------------- | ----- |
| `invalid-name`      | Apelido vazio, longo, com controle ou invisível             | sim   |
| `name-taken`        | Apelido equivalente já presente                             | sim   |
| `room-full`         | Oito participantes                                          | sim   |
| `room-in-match`     | Sala fora do lobby                                          | sim   |
| `room-not-found`    | Código inválido ou sala encerrada                           | sim   |
| `kicked`            | Removido pelo host                                          | sim   |
| `inactive`          | Sem ping ou mensagem por mais de 75 s                       | sim   |
| `rate-limited`      | Excesso de mensagens                                        | sim   |
| `invalid-message`   | JSON inválido, tipo desconhecido ou campos malformados      | não   |
| `not-host`          | Comando exclusivo do host                                   | não   |
| `invalid-phase`     | Comando fora da fase permitida                              | não   |
| `invalid-target`    | `kick` de si mesmo ou de ID inexistente                     | não   |
| `wrong-round`       | `roundIndex` diferente do round vigente                     | não   |
| `wrong-attempt`     | `attemptIndex` fora de ordem ou além das tentativas do modo | não   |
| `already-finished`  | Palpite ou perda após concluir ou perder o round            | não   |
| `invalid-frequency` | Frequência fora da faixa                                    | não   |

**Fechamentos:**

| Código | Situação                                           |
| ------ | -------------------------------------------------- |
| 1000   | Saída voluntária ou sala encerrada                 |
| 4000   | Entrada recusada                                   |
| 4001   | Removido pelo host                                 |
| 4002   | Inatividade                                        |
| 4003   | Abuso: limite de mensagens ou conexão desconhecida |

## Exemplo resumido

```text
A → wss://…/rooms?name=Ana
A ← {"type":"welcome","protocolVersion":1,"playerId":"a1…"}
A ← {"type":"room","room":{"code":"K7Q2M9XH3P","phase":"lobby",…}}
B → wss://…/rooms/K7Q2M9XH3P?name=Bia
A,B ← room (2 participantes)
A → {"type":"set-mode","selection":{"mode":"extreme","frequencyCount":2}}
A → {"type":"start-match"}                  A,B ← room phase=ready
A → {"type":"ready"}  B → {"type":"ready"}  A,B ← room phase=playing, currentRound
A → {"type":"submit-guess","roundIndex":0,"attemptIndex":0,"frequencyHz":231.7}
A → {"type":"submit-guess","roundIndex":0,"attemptIndex":1,"frequencyHz":402.1}
A,B ← room progress (A concluído, sem valores)
B → … dois palpites …                       A,B ← room phase=round-results, lastRound
… cinco rounds …                            A,B ← room phase=final, ranking, rounds
A → {"type":"play-again"}                   A,B ← room phase=lobby, match=null
```

## Uso pelo frontend

O cliente em `src/multiplayer` e `src/application/MultiplayerController.ts` segue este contrato: envia `ping` a cada 25 s após abrir, ignora versões de `room` iguais ou anteriores à atual, fecha o WebSocket ao receber um erro fatal, não reconecta e nunca envia notas. Ele envia um `submit-guess` por confirmação e `forfeit-round` quando a página é ocultada ou o áudio falha durante as referências, ou quando o jogador desiste de um round suspenso. Detalhes da política em `multiplayer-report.md`.
