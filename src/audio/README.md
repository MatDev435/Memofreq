# Áudio — Fase 3

`WebAudioEngine` implementa o contrato `src/application/audioPort.ts` sem conhecer modos, rounds, pontuação, React ou visibilidade da página. A faixa de frequências é recebida do chamador, que pode usar `DEFAULT_RULES.range`; não há duplicação dos limites do jogo na engine.

| Arquivo                  | Responsabilidade                                                          |
| ------------------------ | ------------------------------------------------------------------------- |
| `WebAudioEngine.ts`      | Contexto reutilizável, ganho, vozes, agendamento, cancelamento e descarte |
| `audioContext.ts`        | Interface mínima para injeção do contexto e manutenção de automações      |
| `config.ts`              | Preset aditivo, DSP, normalização, envelopes, volume e habilitação        |
| `WebAudioEngine.test.ts` | Ciclo de vida, precisão do agendamento, proteção e limpeza                |
| `test/fakeAudio.ts`      | Contexto controlado usado somente nos testes                              |

Chame `enable()` a partir de um gesto do usuário e aguarde sua conclusão antes de tocar. Apenas uma reprodução pode existir de cada vez, incluindo sua cauda de saída. Aguarde `finished`, `stop()` ou `cancel()` antes de iniciar outra.

O contrato distingue conclusão normal, parada, cancelamento e interrupção. Uma referência só foi apresentada integralmente se `finished.status` for `completed`. Handles antigos não afetam reproduções posteriores.

O contexto suspenso não retoma sons antigos: as vozes são desconectadas e a reprodução é marcada como interrompida. `dispose()` é irreversível e idempotente; fecha o contexto e remove o listener após a limpeza.

Detalhes, limites e roteiro de avaliação humana: [engine de áudio](../../docs/audio-engine.md). Os testes de navegador em `e2e/audio.spec.ts` usam tanto AudioContext real quanto renderização PCM offline. Eles não certificam qualidade percebida ou compatibilidade com leitores de tela.
