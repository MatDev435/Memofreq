# Relatório da Fase 3 — Engine de áudio

Data: 26/10/2026. A Fase 3 foi autorizada pelo usuário após a entrega do domínio. A Fase 4 não foi iniciada e aguarda autorização.

## Entregas

- Contrato `AudioPort` independente de React, DOM e regras do jogo.
- Engine Web Audio nativa com contexto criado por interação, habilitação concorrente controlada, limite de espera e retomada explícita.
- Tons senoidais, ganho mestre consistente, volume normalizado e som de exemplo independente dos alvos.
- Referências e sequências agendadas integralmente no relógio do áudio, com envelopes dentro da duração.
- Tom contínuo com atualização suave de frequência no mesmo oscilador.
- Fallback para navegadores sem `cancelAndHoldAtTime`, preservando o valor interpolado.
- Handles identificados com resultados distintos para conclusão, parada, cancelamento e interrupção.
- Cancelamento de nós ativos e futuros, proteção contra callbacks antigos e descarte idempotente.
- Limpeza imediata ao suspender/fechar o contexto, sem retomar sons anteriores.
- Testes com contexto controlado e APIs nativas em Chromium desktop e móvel emulado.
- Documentação de contratos, decisões, limites e roteiro de escuta manual.

A faixa permanece centralizada no domínio e é injetada na engine. Nenhuma mecânica foi alterada. Não foram adicionadas dependências nem modificados `package.json` ou lockfile.

O domínio não depende da engine; a aplicação continua estática. Não há partida, slider, controle de volume visível ou botão de teste integrado à tela nesta fase.

## Arquivos criados

```text
src/application/audioPort.ts
src/audio/config.ts
src/audio/audioContext.ts
src/audio/WebAudioEngine.ts
src/audio/WebAudioEngine.test.ts
src/audio/test/fakeAudio.ts
e2e/audio.spec.ts
docs/audio-engine.md
docs/phase-3-report.md
```

Atualizados: `AGENTS.md`, `README.md`, guias de aplicação/áudio/domínio, especificação funcional, arquitetura, acessibilidade, plano de implementação e checklist manual.

## Verificações efetivamente executadas

| Verificação                            | Resultado                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                        | Aprovado: ESLint, formatação, Vitest, tipos e build                                                                             |
| Vitest                                 | 141 testes em sete arquivos aprovados, incluindo 45 testes novos da engine                                                      |
| `npm run test:e2e`                     | 8 testes aprovados em Chromium desktop e móvel emulado                                                                          |
| Web Audio em tempo real                | Habilitação por clique, sequência, ajuste, volume, parada, suspensão e descarte aprovados nos dois perfis                       |
| OfflineAudioContext                    | Amostras nativas, frequência 200/400 Hz, ganho, pausas, amplitude, continuidade e cancelamento futuro aprovados nos dois perfis |
| Tela inicial e axe                     | Smoke tests anteriores preservados e aprovados                                                                                  |
| Revisão de Git e formatação documental | Sem inclusão de builds, dependências instaladas ou resultados temporários                                                       |

Os testes de navegador usam um bundle em memória da engine. O build da aplicação permanece sem integração antecipada de áudio.

Os testes unitários cobrem também: um contexto por engine, ausência de criação no construtor, habilitação duplicada, cancelamento ou descarte durante `resume()`, timeout de autoplay, remoção de timers/listeners, duração curta ou inválida, sequência parcialmente agendada com falha nativa, limites de frequência/Nyquist, fallback no meio de rampas, idempotência, encerramento durante suspensão e preservação de uma reprodução nova diante de callbacks antigos.

Nos testes em tempo real, os nós são nativos e a habilitação ocorre por clique. No teste offline, apenas o estado de controle é adaptado para o renderizador; os nós, automações, relógio e amostras são nativos. Não há afirmação de que áudio foi ouvido por uma pessoa.

## Decisões de integração

- Somente `completed` pode sinalizar apresentação integral de uma referência. O futuro controlador ainda deve verificar `gameId`/`executionId` antes de aceitar a conclusão.
- Uma reprodução ocupa a engine até encerrar sua cauda; o chamador aguarda `finished`, `stop()` ou `cancel()` antes de iniciar a seguinte.
- IDs da engine e IDs do domínio têm funções distintas. A associação entre eles será responsabilidade do controlador da Fase 4.
- O ganho inicial é aproximadamente 0,08, com teto técnico 0,2. Todos os tons usam o mesmo ganho; não há compensação artificial por frequência.
- Entrada, saída e suavização usam 15 ms; a margem inicial de agendamento é 10 ms. Duração e pausas de referências não dependem de timers React/JavaScript.
- A engine observa suspensão do contexto, mas não aplica uma invalidação global por visibilidade. O domínio mantém a política por estado já aprovada.
- Descarte fecha o contexto mesmo se uma parada nativa falhar. Para reutilizar após descarte ou fechamento definitivo, criar outra engine.
- A engine não publica Hz, mensagens acessíveis ou mudanças de foco. A política de acessibilidade permanece para a integração jogável.

## Commits e GitHub

- `3903021` — `feat: implement cancellable Web Audio engine`
- `fe22945` — `test: verify native Web Audio playback and offline rendering`
- Documentação e este relatório são versionados em um commit separado.

O repositório [MatDev435/Memofreq](https://github.com/MatDev435/Memofreq) permanece privado, com branch principal `main`. Autenticação e identidade do remoto foram verificadas. A CI existente também executa os novos testes; seus resultados ficam em [GitHub Actions — Quality](https://github.com/MatDev435/Memofreq/actions/workflows/ci.yml).

## Pendências reais e próxima fase

- Não houve escuta humana, avaliação com fones ou medição de latência física. O roteiro de avaliação está em [engine de áudio](audio-engine.md#roteiro-de-escuta-manual).
- Não foram executados testes reais com NVDA, VoiceOver ou TalkBack; o controle do jogo ainda não existe.
- Chromium móvel emulado não representa Safari/iOS, Firefox ou Android físico. Esses ambientes continuam no checklist manual.
- A Fase 4 conectará domínio, áudio e interface para o primeiro Normal Mode jogável, somente mediante autorização.
