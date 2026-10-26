# Relatório da Fase 2 — Domínio e estados

Data: 26/10/2026. Fase autorizada pelo usuário após a entrega da fundação. A Fase 3 não foi iniciada e depende de nova autorização.

## Entregas

- Configuração central: 50–700 Hz, cinco rounds, duração das referências por modalidade, contagem de três segundos, pausa de 300 ms, distância inicial de 300 cents e corte de pontuação de 500 cents.
- Quatro perfis identificáveis: Normal, Hard, Extreme com duas e Extreme com três frequências.
- Conversão bidirecional entre posição normalizada e frequência em escala logarítmica.
- Geração de referências distintas dentro de cada round, com precisão decimal e aleatoriedade injetada.
- Geração de posição inicial nos intervalos permitidos com uma chamada ao RNG, sem relaxar a distância mínima.
- Pontuação pura em cents, diferença em Hz, médias e soma final sem arredondar cálculos intermediários.
- Modelos imutáveis de desafio, progresso, tentativa, round e resultado final. Cópias congeladas protegem os dados de alterações no objeto do chamador.
- Reducer puro com estados explícitos, eventos por partida/execução, proteção contra ações duplicadas e políticas de interrupção por etapa.
- Guia de contratos para a integração futura, sem implementar engine, controlador React, serviços, backend ou controles jogáveis.

Nenhuma dependência adicionada. `package.json` e lockfile permanecem inalterados. A tela da aplicação continua estática e não foi integrada ao domínio.

## Arquivos criados

```text
src/domain/config.ts
src/domain/config.test.ts
src/domain/frequencies.ts
src/domain/frequencies.test.ts
src/domain/scoring.ts
src/domain/scoring.test.ts
src/domain/models.ts
src/domain/gameDefinition.ts
src/domain/gameDefinition.test.ts
src/domain/gameReducer.ts
src/domain/gameReducer.test.ts
docs/phase-2-report.md
```

Atualizados: `AGENTS.md`, `README.md`, `src/domain/README.md`, `docs/functional-spec.md`, `docs/architecture.md`, `docs/accessibility.md` e `docs/implementation-plan.md`.

## Verificações executadas

`npm run check` passou com:

- ESLint sem avisos.
- Prettier sem divergências.
- **96 testes aprovados em seis arquivos**: 94 testes de domínio em ambiente Node e dois testes preexistentes de componentes em jsdom.
- TypeScript estrito aprovado.
- Build de produção aprovado.

Após a atualização documental, a formatação e o diff também são verificados antes do commit. Os smoke tests E2E existentes permanecem na CI; não foram repetidos localmente nesta fase, pois a interface e sua configuração não mudaram.

### Comportamentos verificados nos testes do domínio

- Configuração, modalidades e duração configurada de cada referência.
- Pontuação para acerto exato, distâncias dos dois lados, corte, valores inválidos e limites zero/dez.
- Médias do Extreme e total de cinco rounds, sem arredondamento intermediário.
- Extremos do slider, centro geométrico, inversão da escala e distâncias proporcionais.
- 2.121 combinações determinísticas de alvo e quantil de sorteio para posição inicial, verificando faixa, pelo menos 300 cents e uma chamada ao RNG.
- Frequências distintas, ordem de sorteio e falha limitada para fonte aleatória defeituosa.
- Distância inicial zero configurada para teste, configuração inviável e caso limite com apenas extremos válidos.
- Definições de cinco rounds, referências válidas e rejeição de dados incompletos ou arrays esparsos.
- Partidas completas simuladas no reducer nos quatro perfis, com teto de cinquenta pontos e alvos respondidos na ordem.
- Respostas imutáveis, cliques duplicados, eventos antigos, troca indevida de modalidade, replay e avanço prematuro bloqueados.
- Ocultação na contagem aguarda retomada explícita; evidência de início da referência interrompe a partida.
- Referência ou tentativa comprometida interrompe a partida; resultados preservam seus dados ao ocultar a página.
- Retomada de preparação da segunda tentativa do Extreme não passa novamente pelas referências.
- Confirmação versus interrupção: a primeira ação válida determina o estado.

## Contratos importantes

O reducer não produz efeitos. Eventos como `AUDIO_READY` e `REFERENCES_FINISHED` são sinais lógicos enviados pela aplicação futura. Os testes desses eventos não comprovam reprodução ou temporização sonora.

O contexto `gameId` + `executionId` deve ser capturado antes de iniciar uma operação assíncrona e reapresentado no callback. Não usar o contexto atual para legitimar uma conclusão antiga. Eventos reais do usuário ou de visibilidade, por outro lado, devem ler o estado vigente no despacho.

A frequência confirmada é o último valor de ajuste aceito pelo reducer. Inícios inválidos são rejeitados sem avançar; definições e configurações inválidas geram `RangeError` antes de criar uma sessão parcial.

`referenceStarted` deve vir da observação real da engine/relógio do áudio na integração futura. O domínio não usa timers para decidir se um som começou. O controlador futuro deve cancelar os efeitos associados a um contexto que deixou de ser vigente.

`showFrequencyVisually` significa somente exibição visual. A política de não anunciar Hz automaticamente continua valendo em todos os modos.

## Commits e GitHub

- `47b629a` — `feat: add game rules frequency generation and scoring`
- `0878d84` — `feat: add guarded game state transitions`
- A documentação e este relatório são versionados em um commit documental separado.

O repositório [MatDev435/Memofreq](https://github.com/MatDev435/Memofreq) permanece privado, com branch principal `main`. A autenticação, o escopo `workflow` e a identidade do remoto foram conferidos antes do envio. As execuções podem ser consultadas em [GitHub Actions — Quality](https://github.com/MatDev435/Memofreq/actions/workflows/ci.yml).

## Pendências para fases posteriores

- Engine de áudio, agendamento e limpeza real de recursos: Fase 3, mediante autorização.
- Integração do domínio ao React, controles, foco e comportamento real de visibilidade do navegador: fases jogáveis.
- Avaliação perceptual sonora e leitores de tela reais: continuam pendentes; nenhum controle de áudio foi implementado nesta fase.
- Sem alterações de mecânicas ou implementação de funcionalidades futuras.
