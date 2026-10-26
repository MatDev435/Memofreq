# Arquitetura

## Estado e princípios

Monólito frontend modular: uma SPA, uma aplicação e um build estático. React cuida da apresentação; TypeScript estrito torna explícitos modelos e contratos. Não há backend nesta etapa.

A fundação contém o ponto de entrada e ferramentas. A Fase 2 implementa o domínio puro; a Fase 3 implementa a engine e seu contrato. A Fase 4 conecta ambos por `GameController`, com adaptador React e uma interface inicial para o Normal Mode. A Fase 5 estende a coordenação e a apresentação para Hard e Extreme, preservando o domínio e a engine existentes. A Fase 6 acrescenta a apresentação final em SVG e tabela, testes entre navegadores e validação estática em subpasta. O visual definitivo permanece uma etapa posterior.

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

A confirmação é aceita sincronamente, impedindo duplicações e alterações durante o fade. A UI aguarda a saída sonora para revelar valores e mover foco. A consolidação de respostas já completas pode ocorrer enquanto a página estiver oculta, pois não inicia áudio nem avança o round; isso evita revelar apenas o último palpite ao retornar. Se houver ocultação nesse intervalo, a resposta já registrada permanece válida; o avanço continua explícito.

O hook observa visibilidade e pagehide, cancela operações na desativação e posterga o descarte definitivo por uma microtask para suportar a reconexão do StrictMode. Engines fechadas recebem outra instância no próximo gesto; uma versão da engine impede notificações antigas de afetarem a nova.

Componentes separados apresentam volume/teste de áudio, ajuste do tom e resultados. A formatação pt-BR com duas casas fica em `src/ui/format.ts`, sem arredondar os dados do domínio. O resultado final desta fase é textual, com uma tabela de cinco rounds; a Fase 6 acrescenta o gráfico sem alterar os dados do resultado.

## Integração da Fase 5

`start(selection)` recebe uma seleção discriminada e cria uma definição imutável. `restart()` lê a modalidade da sessão encerrada, preservando também a quantidade de referências do Extreme. A escolha de modalidade só aparece na inicial.

Normal e Hard usam `playReference`; Extreme envia todos os alvos ordenados e a pausa de 300 ms a uma única chamada de `playSequence`. Apenas a conclusão integral dessa reprodução inicia a primeira tentativa. Não há anúncios, foco ou atualizações por frequência durante a sequência.

No Extreme, `CONFIRM_ATTEMPT` recebe `nextInitialHz` enquanto houver outro palpite. O reducer valida a posição para o próximo alvo antes de aceitar qualquer alteração e registra a resposta atual, avança o índice e define a nova frequência em uma única transição `attempt → attempt`. O controlador usa a suavização de `setFrequency` na mesma voz, sem parada, habilitação adicional ou mensagem viva. A confirmação da UI carrega o `executionId` renderizado; cliques múltiplos e repetição de tecla são filtrados para impedir aceitar involuntariamente o próximo palpite. O callback de término acompanha a identidade do handle contínuo, que atravessa essas transições, e falhas continuam interrompendo a tentativa vigente.

Somente a última confirmação entra em `attempt-result`, uma etapa interna de saída sonora. `COMPLETE_ROUND` exige todas as respostas antes de consolidar a média. `RoundSummary` revela todos os dados juntos depois da cauda; `advance()` serve apenas para avançar o round ou finalizar a partida. Ocultação ou suspensão após um palpite intermediário interrompe a partida, pois o próximo palpite já está ativo. Fechamento do contexto em um resultado completo permite criar outra engine no próximo gesto.

`ToneControl` recebe a política de exibição do domínio e omite o elemento de leitura de Hz no Hard e Extreme; seu valor nativo continua normalizado e seu nome e `aria-valuetext` permanecem estáveis. Resultados numéricos são revelados fora de regiões vivas após a cauda. `RoundSummary` apresenta alvo, palpite, diferença e pontuação de cada frequência, além da média armazenada pelo domínio, sem recálculo ou arredondamento intermediário na UI.

## Integração da Fase 6

`RoundScores` recebe os resultados imutáveis dos cinco rounds e apresenta gráfico SVG e tabela a partir da mesma lista. A escala fixa é 0–10, inclusive para notas baixas ou zero; a altura usa a pontuação original e a formatação pt-BR só afeta os rótulos. O gráfico tem título e descrição acessíveis e a tabela fornece os valores para consulta. Nenhum recebe foco automático ou região viva.

As verificações de navegador comparam barras, tabela e total nas quatro modalidades, preservam o resultado após ocultação e verificam reflow a 320 px com texto a 200%. A ampliação de texto a 200% expôs overflow no título e no volume: texto pode quebrar e o volume passa a duas linhas em telas estreitas. Resultados podem quebrar por campo, mantendo os números da tabela juntos. Espaçamentos internos usam limites proporcionais à viewport em telas estreitas, preservando mais área útil com texto ampliado.

O Playwright usa dois workers com Chromium desktop, Pixel 7 emulado, Firefox e WebKit Linux. São engines automatizadas, sem equivalência a testes em aparelhos físicos ou Safari Apple. Dois servidores de teste independentes entregam o mesmo build: Vite preview e um servidor de arquivos Node em `/memofreq/`, sem transformação ou fallback. O guia de hospedagem registra como publicar o artefato estático quando solicitado.

## Ferramentas e decisões

- React e React DOM são as únicas dependências de produção.
- Vite gera os arquivos estáticos. `base: './'` permite uma instalação em subpasta sem roteador.
- TypeScript estrito, incluindo `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, cobre aplicação, testes e configurações TypeScript.
- ESLint usa análise de tipos e regras de React. Prettier e EditorConfig padronizam arquivos.
- Vitest, jsdom, React Testing Library e user-event verificam componentes. Playwright exercita o build real e axe-core faz avaliação automatizada de acessibilidade no navegador.
- Acessibilidade não depende apenas de lint ou axe. Evitamos instalar um plugin JSX de acessibilidade cujo peer dependency exigia uma linha já descontinuada do ESLint; a CI mantém a linha suportada e a verificação axe no navegador.
- Sem roteador, biblioteca de áudio, gráficos ou estilos na fundação. SVG e tabela apresentam as cinco barras sem dependência de gráficos.

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
tentativa → tentativa seguinte (Extreme, sem tela ou pausa)
tentativa → resultadoTentativa (somente após a última resposta; cauda sonora)
resultadoTentativa → resultadoRound (após todas as tentativas)
resultadoRound → preparandoAudio → contagem (round seguinte)
resultadoRound → resultadoFinal (após o quinto round)
contagem → aguardandoRetomada → preparandoAudio → contagem
estados ativos → interrompida (quando a integridade for comprometida)
resultadoFinal / interrompida → inicial ou nova partida
```

Uma preparação concluída pode ser imediata se o contexto já estiver ativo e sempre inicia a contagem do round. Não há preparação entre palpites do Extreme nem replay de referências.

Eventos carregam identificadores da partida e da execução, que também distinguem a tentativa vigente. Um evento só produz efeito quando corresponde ao estado e aos identificadores vigentes.

Na implementação, `gameId` identifica o desafio e `executionId` identifica a etapa vigente. Esse contador aumenta em cada transição, incluindo avanço de tentativa e round; assim também identifica implicitamente a tentativa. Movimentos do slider mantêm o contador, permitindo atualizar continuamente a mesma voz. No Extreme, a voz também atravessa mudanças do índice de tentativa. O contador não volta a zero ao retornar à inicial, protegendo uma nova partida inclusive se o chamador reutilizar o mesmo `gameId`.

O contexto de callbacks deve ser capturado antes da operação assíncrona; eventos do usuário e visibilidade devem usar o contexto atual. Eventos antigos, transições indevidas e valores inválidos de controle retornam o mesmo objeto de estado. Uma definição inválida é rejeitada atomicamente com `RangeError`, sem iniciar uma partida parcial.

O reducer não sorteia, não mede tempo e não reproduz sons. `REFERENCES_FINISHED` recebe a frequência inicial sorteada externamente. `CONFIRM_ATTEMPT` usa o último valor aceito de `SET_FREQUENCY`; seu parâmetro opcional `nextInitialHz` é uma posição inicial para o palpite seguinte, nunca a resposta atual. `COMPLETE_ROUND` exige todas as respostas, armazena sua média e `FINISH_GAME` exige cinco resultados antes de calcular a soma.

### Geração e precisão

`frequencies.ts` converte posição normalizada e frequência pela escala logarítmica. A posição inicial é sorteada com uma única chamada ao RNG, ponderando os dois intervalos permitidos pela largura logarítmica. Correções de poucos ULPs afastam valores da fronteira quando o erro de ponto flutuante deixaria a distância ligeiramente abaixo do mínimo. No limite de viabilidade, um extremo válido pode ser escolhido; a regra de distância nunca é relaxada.

Uma configuração é rejeitada quando a distância mínima supera metade da extensão total em cents: nesse caso existem alvos para os quais nenhum extremo seria suficientemente distante. A igualdade é permitida e pode resultar em apenas extremos válidos para o alvo central.

Referências distintas são sorteadas em ordem. Para não travar com uma fonte defeituosa que repete sempre o mesmo valor, há um limite de 32 sorteios por referência solicitada; ao excedê-lo, a geração falha explicitamente, sem introduzir alvos determinísticos de substituição.

`scoring.ts` usa a diferença de logaritmos para calcular cents, matematicamente equivalente ao logaritmo da razão e sem overflow/underflow da divisão. A função matemática aceita frequências positivas e finitas; os limites específicos da partida são validados pela definição e pelo reducer. Médias e somas não arredondam parcelas. A formatação pt-BR fica na apresentação, sem alterar os dados do domínio.

Todos os testes do domínio rodam em ambiente Node, sem depender de DOM ou AudioContext. O guia `src/domain/README.md` descreve os arquivos e os contratos de integração.

Invariantes:

- Confirmar só é permitido em `tentativa`.
- Uma resposta confirmada é imutável; o primeiro evento aceito encerra a possibilidade de nova confirmação.
- No Extreme, confirmar registra o palpite e avança exatamente uma posição, sem resultado intermediário. Somente o round completo oferece avanço explícito.
- Avançar o round exige todas as respostas e nunca ultrapassa cinco rounds.
- Não existe ação de replay nem retorno de tentativa para referências já iniciadas.
- Som de tentativa só existe durante uma tentativa ativa.
- Início de áudio e sorteios não ocorrem durante renderização ou dentro do reducer.

## Política de interrupções por estado

O reducer aplica a política por estado a eventos abstratos. A engine observa o estado do AudioContext e notifica interrupções após limpar suas vozes. O controlador observa `document.visibilityState`, associa as notificações ao contexto vigente e cancela os efeitos correspondentes. Perda de foco isolada não equivale a ocultação. `pagehide` encerra a execução ao navegar para fora; não equivale ao evento de simples troca de aba.

| Estado                 | Página oculta                                                 | Suspensão/falha do áudio                                   | Retorno                                                                        |
| ---------------------- | ------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Inicial                | Parar teste de áudio, se houver                               | Informar apenas se necessário                              | Permanecer na inicial; novo teste é explícito                                  |
| Preparando áudio       | Cancelar intenção pendente; nenhum início em segundo plano    | Não avançar; permitir nova interação                       | Preservar seleção ou progresso de resultado; retomar por ação explícita        |
| Contagem               | Cancelar contagem e áudio futuro; ir para aguardando retomada | Mesmo tratamento, se nenhuma referência começou            | Ação explícita recomeça três segundos                                          |
| Aguardando retomada    | Permanecer sem áudio                                          | Manter aguardando                                          | Aguardar ação; não avançar automaticamente                                     |
| Referências            | Invalidar partida e cancelar tudo                             | Invalidar partida e cancelar tudo                          | Mostrar motivo e oferecer nova partida; sem replay                             |
| Tentativa              | Invalidar partida e cancelar tudo                             | Invalidar partida e cancelar tudo                          | Mostrar motivo; respostas não viram resultado final válido                     |
| Resultado da tentativa | Preservar partida                                             | Preservar partida; engine ficará indisponível até retomada | Etapa interna da cauda após a última resposta; consolidar o round sem novo som |
| Resultado do round     | Preservar partida                                             | Preservar partida                                          | Ação explícita inicia preparação da próxima contagem                           |
| Resultado final        | Preservar resultado                                           | Sem efeito sobre os dados                                  | Sem áudio ou avanço automático                                                 |
| Interrompida           | Manter encerrada                                              | Cancelamento idempotente                                   | Nova partida ou inicial                                                        |

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
- Um oscilador contínuo por round; no Extreme, essa voz permanece durante todos os palpites. Atualizações substituem automação pendente sem reiniciar a voz.
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

## Apresentação da Fase 7

O redesign não altera `src/domain`, `src/application`, `src/audio` nem a fábrica do controlador. `App` continua assinando o mesmo snapshot e enviando as mesmas ações. O único estado visual adicional é a pausa das animações, local ao componente, sem persistência ou influência no áudio.

- `HomeScreen`, `PlayingScreen` e `FinalScreen` compõem as telas; `RoundSummary` apresenta o round consolidado. Todos recebem dados e callbacks já disponíveis.
- `SessionHeader`, `GameProgress`, `AudioControls`, `ToneControl`, `KeyboardHints`, `AttemptResult`, `ScoreRing`, `RoundChart` e `RoundScoreTable` são componentes reutilizáveis. A escolha entre uma/duas/três frequências vem da sessão e dos resultados, sem configuração duplicada.
- O slider permanece nativo, com os mesmos handlers e guardas de confirmação. O DOM dos controles e o foco permanecem entre os palpites do Extreme; não há animação de remontagem, resultado ou fala entre eles.
- `ScoreRing` normaliza a apresentação em dez ou cinquenta; não calcula pontuação. Gráfico, tabela e detalhes recebem os valores imutáveis do domínio, sem arredondamento intermediário ou soma alternativa.
- `Brand`, `Icon` e `WaveArt` são SVGs próprios e decorativos. Ondas determinísticas são pré-calculadas e memoizadas, sem amostrar áudio ou gerar pistas da frequência. Não há loop de animação no React.
- CSS é carregado na ordem `global.css` (tokens, elementos compartilhados e menu), `game.css` (sessão/gameplay), `results.css` (round/final). Breakpoints reorganizam a composição; o conteúdo pode quebrar com texto ampliado. Inter variável e licença OFL ficam em `src/ui/fonts/`; Vite emite o asset com caminho relativo ao build.
- Animações usam CSS. `prefers-reduced-motion` e `data-motion="paused"` desativam animações/transições; números não são interpolados e as ações nunca esperam um efeito terminar. A transição de abertura/fechamento de `details` é uma melhoria progressiva, com operação nativa preservada em navegadores sem esse recurso.

Referências originais: `docs/references/phase-7/`. Capturas reais e relatório: `docs/images/phase-7/` e `docs/phase-7-report.md`.
