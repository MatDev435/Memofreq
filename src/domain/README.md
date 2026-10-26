# Domínio — Fase 2

Código TypeScript puro, sem React, DOM, Web Audio API, timers ou persistência. Os testes deste diretório usam o ambiente Node do Vitest.

| Arquivo             | Responsabilidade                                                          |
| ------------------- | ------------------------------------------------------------------------- |
| `config.ts`         | Regras centralizadas, validação e quatro perfis de modalidade             |
| `frequencies.ts`    | Conversão logarítmica, referências distintas e posição inicial            |
| `scoring.ts`        | Cents, resultado individual, médias e soma sem arredondamento             |
| `models.ts`         | Definição, sessão, resultados, estados e eventos imutáveis                |
| `gameDefinition.ts` | Gerar e validar desafios de cinco rounds; copiar e congelar entradas      |
| `gameReducer.ts`    | Transições, respostas definitivas, avanço, interrupções e eventos antigos |

## Contratos para integração futura

- A aleatoriedade é obrigatoriamente injetada e deve produzir valores em `[0, 1)`. Não existe RNG oculto no reducer.
- `createGameDefinition` sorteia um desafio; `snapshotGameDefinition` também aceita um desafio externo validável, sem criar API ou serviço fictício.
- `createInitialState` recebe a visibilidade inicial. `gameReducer` recebe o estado e um evento acompanhado de `gameId` e `executionId`.
- `getEventContext` fornece esse par de identificação. Para callbacks assíncronos, capture-o **antes** de iniciar a operação; não substitua o contexto antigo pelo atual quando o callback chegar.
- Interações atuais e eventos reais de visibilidade usam o contexto vigente. A aplicação deve lê-lo no despacho, evitando closures antigas em listeners permanentes.
- `executionId` aumenta em mudanças de etapa, cancelamentos, reinícios e saída. Não muda a cada movimento do slider ou simples retorno de visibilidade em resultado.
- Eventos fora de etapa, antigos ou com frequência inválida preservam o estado. Definições ou configurações inválidas lançam `RangeError` antes de criar uma sessão parcial.
- `REFERENCES_FINISHED` recebe a posição inicial da primeira tentativa; `SET_FREQUENCY` altera o valor atual. No Extreme, `CONFIRM_ATTEMPT` exige `nextInitialHz` enquanto houver outro palpite, validando-o em relação ao próximo alvo antes de registrar e avançar atomicamente. A resposta registrada continua sendo o último valor atual aceito, sem substituição pelo parâmetro do próximo palpite. Somente a última confirmação entra na etapa interna `attempt-result` para encerrar o áudio e consolidar o round.
- O sinal `referenceStarted` é uma observação da futura engine/relógio do áudio. Se verdadeiro ao interromper a contagem, a partida é invalidada; o domínio não tenta inferi-lo por timers.
- `showFrequencyVisually` controla somente a futura apresentação visual. Não autoriza anúncios de Hz por leitores de tela em modo algum.

Os eventos com nomes de áudio representam confirmações lógicas; o domínio não reproduz sons. A engine está em `src/audio`. O controlador da Fase 4 associa seus resultados aos eventos e encerra efeitos cancelados quando o contexto de execução deixa de ser vigente.
