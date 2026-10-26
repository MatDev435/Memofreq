# Arquitetura

## Estado e princípios

Monólito frontend modular: uma SPA, uma aplicação e um build estático. React cuida da apresentação; TypeScript estrito torna explícitos modelos e contratos. Não há backend nesta etapa.

A fundação contém somente o ponto de entrada, tela estática e ferramentas. Os módulos de domínio, aplicação e áudio estão reservados por arquivos explicativos, sem implementação antecipada.

## Limites e dependências

| Camada            | Responsabilidade                                                    | Dependências permitidas                                              |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/domain`      | Configuração, modos, geração de frequências, pontuação e transições | TypeScript e funções puras; aleatoriedade recebida como argumento    |
| `src/application` | Coordenar ações, efeitos, áudio e interrupções                      | Domínio e contrato de áudio; React apenas no adaptador de integração |
| `src/audio`       | Executar Web Audio API, agendar, suavizar e limpar                  | APIs do navegador e contrato de áudio                                |
| `src/ui`          | Telas, controles, estilos, gráficos e acessibilidade                | React, modelos de apresentação e ações recebidas                     |
| `src/app`         | Compor interface e dependências concretas                           | Camadas anteriores                                                   |

O domínio nunca importa React, DOM ou Web Audio API. A engine não recebe um “modo” ou “round”: recebe frequências, durações e comandos sonoros. Componentes não calculam pontuação nem decidem se uma transição é válida.

A aplicação será a única coordenadora dos efeitos da partida. O reducer será puro e não criará osciladores, timers ou sorteios escondidos em renderizações. Não adicionar container de injeção, event bus, bibliotecas de estado ou repositórios vazios.

## Ferramentas e decisões

- React e React DOM são as únicas dependências de produção.
- Vite gera os arquivos estáticos. `base: './'` permite uma instalação em subpasta sem roteador.
- TypeScript estrito, incluindo `noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, cobre aplicação, testes e configurações TypeScript.
- ESLint usa análise de tipos e regras de React. Prettier e EditorConfig padronizam arquivos.
- Vitest, jsdom, React Testing Library e user-event verificam componentes. Playwright exercita o build real e axe-core faz avaliação automatizada de acessibilidade no navegador.
- Acessibilidade não depende apenas de lint ou axe. Evitamos instalar um plugin JSX de acessibilidade cujo peer dependency exigia uma linha já descontinuada do ESLint; a CI mantém a linha suportada e a verificação axe no navegador.
- Sem roteador, biblioteca de áudio, gráficos ou estilos na fundação. SVG e tabela serão suficientes para as cinco barras quando o resultado final for implementado.

As dependências ficam fixadas no `package.json` e no lockfile. Node 24 e npm 11 são a linha de execução aprovada. Não atualizar majors durante uma fase sem conferir compatibilidade e executar os checks.

## Modelo de domínio planejado

Modelos diferenciarão configuração da partida, definição do desafio, progresso e resultado final. O formato exato será implementado e testado na Fase 2.

- Configuração: modo, quantidade de referências, faixa e versão das regras.
- Definição: cinco listas ordenadas de alvos, independentes da interface.
- Progresso: índice do round e da tentativa, fase vigente e respostas confirmadas.
- Tentativa: alvo, resposta, diferença em Hz, distância em cents e pontuação sem arredondamento.
- Resultado: modalidade identificável como `normal`, `hard`, `extreme-2` ou `extreme-3`, cinco resultados de round e soma final.

Valores numéricos serão validados no limite do domínio. Não usar `NaN`, infinito ou números fora da faixa como estado provisório válido. Uma entrada inválida não se transforma em pontuação zero silenciosamente.

A geração logarítmica e a pontuação serão funções separadas. A posição inicial será amostrada diretamente na união dos intervalos permitidos a pelo menos 300 cents do alvo. Não haverá arredondamento na geração ou no armazenamento de resultados.

## Máquina de estados planejada

União discriminada e reducer puro, sem biblioteca adicional:

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

Eventos carregarão identificadores da partida e da execução; operações sensíveis identificarão também a tentativa. Um evento só produz efeito quando corresponde ao estado e aos identificadores vigentes.

Invariantes:

- Confirmar só é permitido em `tentativa`.
- Uma resposta confirmada é imutável; o primeiro evento aceito encerra a possibilidade de nova confirmação.
- Avançar exige resultado da tentativa atual. No Extreme, o índice avança exatamente uma posição.
- Avançar o round exige todas as respostas e nunca ultrapassa cinco rounds.
- Não existe ação de replay nem retorno de tentativa para referências já iniciadas.
- Som de tentativa só existe durante uma tentativa ativa.
- Início de áudio e sorteios não ocorrem durante renderização ou dentro do reducer.

## Política de interrupções por estado

Aplicar a política no controlador, não em um listener global que invalida tudo. Usar `document.visibilityState` para ocultação e `AudioContext.state` para suspensão efetiva. Perda de foco isolada não equivale a ocultação.

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

## Engine de áudio planejada

Contrato pequeno, definido quando houver consumidor real, para habilitar áudio, reproduzir sequência, iniciar tom contínuo, atualizar frequência/volume, cancelar e descartar.

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
