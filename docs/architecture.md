# Arquitetura

## Estado e princípios

Monólito frontend modular: uma SPA, uma aplicação e um build estático. React cuida da apresentação; TypeScript estrito torna explícitos modelos e contratos. Não há backend nesta etapa.

A fundação contém o ponto de entrada e ferramentas. A Fase 2 implementa o domínio puro; a Fase 3 implementa a engine e seu contrato. A Fase 4 conecta ambos por `GameController`, com adaptador React e uma interface inicial para o Normal Mode. A Fase 5 estende a coordenação e a apresentação para Hard e Extreme, preservando o domínio e a engine existentes. O visual definitivo permanece uma etapa posterior.

## Limites e dependências

| Camada            | Responsabilidade                                                    | Dependências permitidas                                              |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/domain`      | Configuração, modos, geração de frequências, pontuação e transições | TypeScript e funções puras; aleatoriedade recebida como argumento    |
| `src/application` | Coordenar ações, efeitos, áudio e interrupções                      | Domínio e contrato de áudio; React apenas no adaptador de integração |
| `src/audio`       | Executar Web Audio API, agendar, suavizar e limpar                  | APIs do navegador e contrato de áudio                                |
| `src/ui`          | Telas, controles, estilos, gráficos e acessibilidade                | React, modelos de apresentação e ações recebidas                     |
| `src/app`         | Compor interface e dependências concretas                           | Camadas anteriores                                                   |

O domínio nunca importa React, DOM ou Web Audio API. A engine não recebe um “modo” ou “round”: recebe frequências, durações e comandos sonoros. Componentes não calculam pontuação nem decidem se uma transição é válida.

A aplicação é a coordenadora dos efeitos da partida. O reducer é puro e não cria osciladores, timers ou sorteios escondidos em renderizações. Não adicionar container de injeção, event bus, bibliotecas de estado ou repositórios vazios.

## Integração da Fase 4

`src/app/createGameController.ts` compõe a engine concreta, a configuração central e a aleatoriedade com `crypto.getRandomValues`. O controlador conserva o estado mais recente fora das closures do React e publica snapshots imutáveis por `useSyncExternalStore`; regras e resultados permanecem no reducer.

Os comandos de iniciar/retomar habilitam áudio dentro do gesto, antes de aguardar qualquer operação. Timers da contagem usam prazo monotônico e são cancelados na mudança de execução. Apenas o resultado `completed` da referência vigente inicia automaticamente a tentativa, com uma posição válida sorteada externamente.

A confirmação é aceita sincronamente, impedindo duplicações e alterações durante o fade. A UI aguarda a saída sonora para revelar valores e mover foco. Se houver ocultação nesse intervalo, a resposta já registrada permanece válida; o avanço continua explícito.

O hook observa visibilidade e pagehide, cancela operações na desativação e posterga o descarte definitivo por uma microtask para suportar a reconexão do StrictMode. Engines fechadas recebem outra instância no próximo gesto; uma versão da engine impede notificações antigas de afetarem a nova.

Componentes separados apresentam volume/teste de áudio, ajuste do tom e resultados. A formatação pt-BR com duas casas fica em `src/ui/format.ts`, sem arredondar os dados do domínio. O resultado final desta fase é textual, com uma tabela de cinco rounds; o gráfico pertence à Fase 6.

## Integração da Fase 5

`start(selection)` recebe uma seleção discriminada e cria uma definição imutável. `restart()` lê a modalidade da sessão encerrada, preservando também a quantidade de referências do Extreme. A escolha de modalidade só aparece na inicial.

Normal e Hard usam `playReference`; Extreme envia todos os alvos ordenados e a pausa de 300 ms a uma única chamada de `playSequence`. Apenas a conclusão integral dessa reprodução inicia a primeira tentativa. Não há anúncios, foco ou atualizações por frequência durante a sequência.

Após confirmar, `COMPLETE_ROUND` só consolida o round quando todas as respostas existem. Antes disso, a interface apresenta o resultado individual e `advance()` prepara a próxima tentativa com nova frequência inicial válida. `AUDIO_READY` para esse destino inicia apenas o tom contínuo, sem contagem nem referências. Suspensão ou ocultação durante a preparação exige retomada explícita e conserva as respostas anteriores. Fechamento do contexto em resultados permite criar outra engine no próximo gesto.

`ToneControl` recebe a política de exibição do domínio e omite o elemento de leitura de Hz no Hard e Extreme; seu valor nativo continua normalizado e seu nome e `aria-valuetext` permanecem estáveis. Resultados numéricos são revelados fora de regiões vivas após a cauda. `RoundSummary` apresenta as pontuações individuais e a média armazenada pelo domínio, sem recálculo ou arredondamento intermediário na UI.

## Ferramentas e decisões

- React e React DOM são as únicas dependências de produção.
- Vite gera os arquivos estáticos. `base: './'` permite uma instalação em subpasta sem roteador.
- TypeScript estrito, incluindo `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, cobre aplicação, testes e configurações TypeScript.
- ESLint usa análise de tipos e regras de React. Prettier e EditorConfig padronizam arquivos.
- Vitest, jsdom, React Testing Library e user-event verificam componentes. Playwright exercita o build real e axe-core faz avaliação automatizada de acessibilidade no navegador.
- Acessibilidade não depende apenas de lint ou axe. Evitamos instalar um plugin JSX de acessibilidade cujo peer dependency exigia uma linha já descontinuada do ESLint; a CI mantém a linha suportada e a verificação axe no navegador.
- Sem roteador, biblioteca de áudio, gráficos ou estilos na fundação. SVG e tabela serão suficientes para as cinco barras quando o resultado final for implementado.

As dependências ficam fixadas no `package.json` e no lockfile. Node 24 e npm 11 são a linha de execução aprovada. Não atualizar majors durante uma fase sem conferir compatibilidade e executar os checks.

## Modelo de domínio implementado

Os modelos diferenciam configuração da partida, definição do desafio, progresso e resultado final. Entradas são copiadas e congeladas: mudanças posteriores nos objetos do chamador não modificam alvos, regras ou resultados da sessão.

- Configuração: modo, quantidade de referências, faixa e versão das regras.
- Definição: cinco listas ordenadas de alvos, independentes da interface.
- Progresso: índice do round e da tentativa, fase vigente e respostas confirmadas.
- Tentativa: alvo, resposta, diferença em Hz, distância em cents e pontuação sem arredondamento.
- Resultado: modalidade identificável como `normal`, `hard`, `extreme-2` ou `extreme-3`, cinco resultados de round e soma final.

Valores numéricos serão validados no limite do domínio. Não usar `NaN`, infinito ou números fora da faixa como estado provisório válido. Uma entrada inválida não se transforma em pontuação zero silenciosamente.

A geração logarítmica e a pontuação serão funções separadas. A posição inicial será amostrada diretamente na união dos intervalos permitidos a pelo menos 300 cents do alvo. Não haverá arredondamento na geração ou no armazenamento de resultados.

## Máquina de estados implementada

União discriminada e reducer puro em `src/domain/gameReducer.ts`, sem biblioteca adicional:

```text
inicial → preparandoAudio → contagem → referencias → tentativa
tentativa → resultadoTentativa
resultadoTentativa → preparandoAudio → tentativa seguinte (Extreme)
resultadoTentativa → resultadoRound (após todas as tentativas)
resultadoRound → preparandoAudio → contagem (round seguinte)
resultadoRound → resultadoFinal (após o quinto round)
contagem → aguardandoRetomada → preparandoAudio → contagem
estados ativos → interrompida (quando a integridade for comprometida)
resultadoFinal / interrompida → inicial ou nova partida
```

Uma preparação concluída pode ser imediata se o contexto já estiver ativo. O destino dessa preparação deve ser explícito: iniciar contagem ou iniciar uma nova tentativa, nunca repetir referências.

Eventos carregam identificadores da partida e da execução, que também distinguem a tentativa vigente. Um evento só produz efeito quando corresponde ao estado e aos identificadores vigentes.

Na implementação, `gameId` identifica o desafio e `executionId` identifica a etapa vigente. Esse contador aumenta em cada transição, incluindo avanço de tentativa e round; assim também identifica implicitamente a tentativa. Movimentos do slider mantêm o contador, permitindo atualizar continuamente a mesma voz no futuro. O contador não volta a zero ao retornar à inicial, protegendo uma nova partida inclusive se o chamador reutilizar o mesmo `gameId`.

O contexto de callbacks deve ser capturado antes da operação assíncrona; eventos do usuário e visibilidade devem usar o contexto atual. Eventos antigos, transições indevidas e valores inválidos de controle retornam o mesmo objeto de estado. Uma definição inválida é rejeitada atomicamente com `RangeError`, sem iniciar uma partida parcial.

O reducer não sorteia, não mede tempo e não reproduz sons. `REFERENCES_FINISHED` recebe a frequência inicial sorteada externamente. `CONFIRM_ATTEMPT` usa o último valor aceito de `SET_FREQUENCY`. `COMPLETE_ROUND` exige todas as respostas, armazena sua média e `FINISH_GAME` exige cinco resultados antes de calcular a soma.

### Geração e precisão

`frequencies.ts` converte posição normalizada e frequência pela escala logarítmica. A posição inicial é sorteada com uma única chamada ao RNG, ponderando os dois intervalos permitidos pela largura logarítmica. Correções de poucos ULPs afastam valores da fronteira quando o erro de ponto flutuante deixaria a distância ligeiramente abaixo do mínimo. No limite de viabilidade, um extremo válido pode ser escolhido; a regra de distância nunca é relaxada.

Uma configuração é rejeitada quando a distância mínima supera metade da extensão total em cents: nesse caso existem alvos para os quais nenhum extremo seria suficientemente distante. A igualdade é permitida e pode resultar em apenas extremos válidos para o alvo central.

Referências distintas são sorteadas em ordem. Para não travar com uma fonte defeituosa que repete sempre o mesmo valor, há um limite de 32 sorteios por referência solicitada; ao excedê-lo, a geração falha explicitamente, sem introduzir alvos determinísticos de substituição.

`scoring.ts` usa a diferença de logaritmos para calcular cents, matematicamente equivalente ao logaritmo da razão e sem overflow/underflow da divisão. A função matemática aceita frequências positivas e finitas; os limites específicos da partida são validados pela definição e pelo reducer. Médias e somas não arredondam parcelas. A formatação pt-BR permanece uma responsabilidade futura da apresentação.

Todos os testes do domínio rodam em ambiente Node, sem depender de DOM ou AudioContext. O guia `src/domain/README.md` descreve os arquivos e os contratos de integração.

Invariantes:

- Confirmar só é permitido em `tentativa`.
- Uma resposta confirmada é imutável; o primeiro evento aceito encerra a possibilidade de nova confirmação.
- Avançar exige resultado da tentativa atual. No Extreme, o índice avança exatamente uma posição.
- Avançar o round exige todas as respostas e nunca ultrapassa cinco rounds.
- Não existe ação de replay nem retorno de tentativa para referências já iniciadas.
- Som de tentativa só existe durante uma tentativa ativa.
- Início de áudio e sorteios não ocorrem durante renderização ou dentro do reducer.

## Política de interrupções por estado

O reducer aplica a política por estado a eventos abstratos. A engine observa o estado do AudioContext e notifica interrupções após limpar suas vozes. O controlador observa `document.visibilityState`, associa as notificações ao contexto vigente e cancela os efeitos correspondentes. Perda de foco isolada não equivale a ocultação. `pagehide` encerra a execução ao navegar para fora; não equivale ao evento de simples troca de aba.

| Estado                 | Página oculta                                                 | Suspensão/falha do áudio                                   | Retorno                                                                     |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Inicial                | Parar teste de áudio, se houver                               | Informar apenas se necessário                              | Permanecer na inicial; novo teste é explícito                               |
| Preparando áudio       | Cancelar intenção pendente; nenhum início em segundo plano    | Não avançar; permitir nova interação                       | Preservar seleção ou progresso de resultado; retomar por ação explícita     |
| Contagem               | Cancelar contagem e áudio futuro; ir para aguardando retomada | Mesmo tratamento, se nenhuma referência começou            | Ação explícita recomeça três segundos                                       |
| Aguardando retomada    | Permanecer sem áudio                                          | Manter aguardando                                          | Aguardar ação; não avançar automaticamente                                  |
| Referências            | Invalidar partida e cancelar tudo                             | Invalidar partida e cancelar tudo                          | Mostrar motivo e oferecer nova partida; sem replay                          |
| Tentativa              | Invalidar partida e cancelar tudo                             | Invalidar partida e cancelar tudo                          | Mostrar motivo; respostas não viram resultado final válido                  |
| Resultado da tentativa | Preservar partida                                             | Preservar partida; engine ficará indisponível até retomada | Continuar mediante ação do usuário; habilitar áudio antes de nova tentativa |
| Resultado do round     | Preservar partida                                             | Preservar partida                                          | Ação explícita inicia preparação da próxima contagem                        |
| Resultado final        | Preservar resultado                                           | Sem efeito sobre os dados                                  | Sem áudio ou avanço automático                                              |
| Interrompida           | Manter encerrada                                              | Cancelamento idempotente                                   | Nova partida ou inicial                                                     |

Não avançar contagem ou iniciar tentativas enquanto a página estiver oculta. Ao chegar qualquer evento de término, conferir novamente visibilidade e execução vigente.

Na corrida entre o fim da contagem e o primeiro tom, se o horário de início da referência já foi atingido no relógio do contexto ou existe evidência de reprodução, a ocultação será tratada como interrupção de referência. A possibilidade de recomeçar contagem só existe quando nenhum som de referência começou.

Na corrida entre confirmação e interrupção, o primeiro evento válido define o estado. Se a resposta já foi confirmada, a tela de resultado é preservada; se a interrupção foi aceita antes, a confirmação posterior não cria um resultado.

Fechar/recarregar a página perde o progresso: não há persistência nesta versão. Sair explicitamente da partida cancela todos os recursos. Não invalidar uma partida apenas por retornar de uma tela de resultados com o contexto suspenso.

## Engine de áudio implementada

O contrato `AudioPort` é implementado por `WebAudioEngine`: habilitar áudio, reproduzir referências ou sequências, iniciar tom contínuo, atualizar frequência/volume, cancelar e descartar. A engine recebe a faixa de frequências e não importa regras, modos ou estados do jogo.

Cada reprodução fornece handle com ID e promessa de término. Os resultados `completed`, `stopped`, `cancelled` e `interrupted` distinguem referência concluída de cancelamento. O controlador só aceita uma conclusão normal com o contexto de execução ainda vigente. Handles antigos não afetam novas reproduções.

Os testes unitários usam um contexto controlado; Playwright verifica AudioContext real e amostras de OfflineAudioContext. O [guia da engine](audio-engine.md) detalha grafos, parâmetros, concorrência, fallback de automação e limites da validação.

- Um contexto reutilizado durante a vida da engine.
- Ativação ou `resume()` em interação do usuário, com confirmação de estado ativo antes de avançar.
- Osciladores `sine` com ganho por voz e ganho mestre.
- Referências agendadas por `currentTime`, com duração e pausas precisas, envelopes dentro da duração.
- O término da última voz conclui a sequência vigente; timers visuais não definem o fim sonoro.
- Um oscilador por tentativa. Atualizações substituem automação pendente sem reiniciar a voz.
- Suavização de aproximadamente 15 ms; cancelamento preserva continuidade de parâmetros antes de agendar o novo destino.
- Fechamento suave do ganho, parada e desconexão após a cauda.
- Registro de todos os nós ativos ou agendados, incluindo aqueles cujo início ainda não ocorreu.
- Cancelamento idempotente; callbacks cancelados não causam transições.
- Descarte definitivo fecha contexto e listeners; desmontagem, reinício e Strict Mode não duplicam vozes.

A aplicação congela a resposta ao aceitar a confirmação; a cauda sonora de saída não continua alterando o valor confirmado. Não há referência ativa ao disponibilizar o ajuste.

## Acessibilidade e sincronização

Ver `accessibility.md`. Nenhum Hz vai para região viva ou nome do slider. Dados dos resultados são consultáveis sob demanda.

Eventos acessíveis virão do mesmo estado da partida. Não publicar mensagens por frame ou por alteração de frequência. A aplicação não controla o tempo de fala de leitores de tela; o plano de validação deve registrar qualquer interferência real.

## Extensão futura

Uma definição de desafio pode futuramente vir de outra fonte sem mudar a pontuação. Um resultado serializável poderá ser enviado a uma API quando ela existir. Não criar agora cliente HTTP, autenticação, persistência ou contrato de repositório sem uso.

Versão das regras e modalidades distintas permitirão separar rankings futuramente. Integridade competitiva exige validação no servidor; esconder valores na interface não protege dados do JavaScript contra inspeção.

## Referências técnicas

- [Vite — início e build](https://vite.dev/guide/).
- [Vitest — requisitos e configuração](https://vitest.dev/guide/).
- [MDN — AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext).
- [MDN — AudioParam](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam).
- [W3C — padrão de slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).
