# Relatório da Fase 4 — Normal jogável

Data: 26/10/2026. A Fase 4 foi autorizada pelo usuário com prioridade em uma interface funcional para testar o áudio e a mecânica. O acabamento visual definitivo permanece uma etapa própria; a Fase 5 não foi iniciada.

Veja também o [relatório consolidado com seis capturas da interface](visual-report.md), cobrindo as Fases 1 a 4, em desktop e celular emulado.

## Entregas

- Tela inicial com objetivo, Normal selecionado, teste de áudio, parada do teste, volume e recomendação de fones.
- Cinco rounds completos: contagem de três segundos, referência de três segundos apresentada uma vez, início automático do tom contínuo, slider logarítmico e confirmação definitiva.
- Botões alternativos de ajuste, setas, Page Up/Page Down, Home/End e foco visível.
- Frequência atual visual no Normal, sem Hz em nomes acessíveis ou anúncios vivos.
- Revelação de alvo, resposta, diferença e pontos após o encerramento suave do tom.
- Resultado final textual com total e tabela dos cinco rounds, jogar novamente e voltar ao início.
- Política de visibilidade por estado, cancelamento ao sair, callbacks identificados e recuperação de contexto fechado.
- Interface inicial responsiva, com componentes substituíveis para o refinamento visual posterior.

Sem implementação de Hard/Extreme, gráfico, persistência, backend ou contas. Nenhuma dependência foi adicionada; regras, fórmulas e tempos aprovados foram preservados.

## Organização

Novos arquivos:

```text
src/application/GameController.ts
src/application/GameController.test.ts
src/application/useGameController.ts
src/app/createGameController.ts
src/test/controlledAudio.ts
src/ui/components/AudioControls.tsx
src/ui/components/ToneControl.tsx
src/ui/components/AttemptResult.tsx
src/ui/format.ts
e2e/normal.spec.ts
docs/phase-4-report.md
```

Atualizados: `App.tsx`, testes da aplicação, CSS, README, AGENTS, guias de aplicação/domínio, especificação, arquitetura, acessibilidade, engine, plano e checklist manual.

O controlador coordena efeitos e publica snapshots; React apresenta o estado. O domínio continua puro e a engine mantém a responsabilidade por síntese e temporização sonora. A formatação de apresentação utiliza pt-BR e duas casas sem modificar precisão interna.

## Verificações executadas

| Verificação                 | Resultado                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `npm run check`             | Tipos, ESLint, formatação, testes e build aprovados                                                             |
| Vitest                      | 157 testes em oito arquivos aprovados                                                                           |
| `npm run test:e2e`          | 12 testes aprovados em Chromium desktop e móvel emulado                                                         |
| Normal completo             | Cinco rounds reais nos dois perfis, com contagem/referência sem atalhos de duração                              |
| Recursos de áudio           | Um contexto reutilizado; fontes desconectadas após respostas e saída                                            |
| Acessibilidade automatizada | Axe sem violações detectadas na inicial, tentativa e resultado final; foco, teclado e regiões vivas verificados |
| Visibilidade controlada     | Contagem pausada, referência interrompida e resultado preservado                                                |
| Inspeção visual             | Capturas de inicial, tentativa e resultado em desktop e Pixel 7 emulado revisadas                               |
| Prévia local                | Servidor existente do projeto confirmado por HTTP e conteúdo em `http://localhost:5173/`                        |

Os testes unitários também cobrem StrictMode sem criação antecipada de AudioContext, desmontagem, bloqueio de ações duplicadas, congelamento na confirmação, falha de autoplay, troca de engine fechada e rejeição de notificações antigas.

O E2E usa APIs Web Audio reais e observa criação/liberação de fontes. As mudanças de visibilidade são simuladas por eventos do documento para verificar a integração do listener; não representam teste físico de troca de aba em todos os navegadores. A emulação móvel também não equivale a um aparelho físico.

## Política de fala e foco implementada

- “Ajustar tom” tem nome estável e `aria-valuetext="Ajuste pelo som"`, com posição normalizada.
- O range usa `step="any"` para preservar a frequência inicial e handlers explícitos para teclado. Botões de nome estável oferecem outra via de ajuste.
- Frequência visual fica fora de regiões vivas e de descrições dinâmicas. Resultados numéricos são texto acessível para consulta intencional.
- Durante contagem, referência e tentativa, a aplicação mantém a região viva vazia e não move foco sobre os tons.
- Ao confirmar, o domínio registra a resposta antes do fade; a apresentação e o foco no resultado aguardam o término sonoro.
- Os anúncios de conclusão não incluem Hz ou pontuações. O título focado no resultado final não contém números.

Não se afirma silêncio universal de leitores de tela: alguns narram o próprio valor nativo. A alternativa por botões permanece disponível.

## Testes humanos e limite do ambiente

O NVDA foi encontrado instalado no Windows. A inicialização da ferramenta de controle Windows falhou antes de qualquer interação com `sandboxCwd is not a local file URI: file:///home/mat/www/memofreq`. O reset da sessão e uma segunda tentativa produziram o mesmo erro.

**Não foram executadas escuta humana com fones nem avaliação da fala real do NVDA/VoiceOver/TalkBack.** A interface agora permite fazê-las diretamente, sem console. O checklist continua indicando essas pendências, assim como Firefox, Safari e dispositivos físicos.

## Como testar pela interface

1. Abra a prévia local; se não estiver em execução, rode `npm run dev`.
2. Use Testar áudio, ajuste Volume e encerre o exemplo ou aguarde sua conclusão.
3. Inicie Normal, memorize a referência e ajuste o tom contínuo.
4. Confirme, consulte o resultado e avance até completar cinco rounds.
5. Verifique saída/reinício, teclado, ausência de replay e comportamento ao ocultar a aba nas diferentes etapas.

O servidor da porta 5173 já existia, foi identificado como este checkout e foi reutilizado sem encerrá-lo. Os servidores temporários dos E2E são gerenciados pelo Playwright.

## Commits e GitHub

- `a98fd85` — `feat: coordinate Normal mode audio and game lifecycle`
- `7bd3a2c` — `feat: add playable Normal mode interface and browser tests`
- Documentação e relatório são versionados em um commit separado.

Repositório privado: [MatDev435/Memofreq](https://github.com/MatDev435/Memofreq), branch principal `main`. Autenticação e identidade do remoto foram conferidas antes da sincronização. Execuções remotas: [GitHub Actions — Quality](https://github.com/MatDev435/Memofreq/actions/workflows/ci.yml).

A próxima implementação prevista é Hard/Extreme na Fase 5, somente após autorização. O gráfico e a revisão conjunta ficam na Fase 6; o refinamento visual definitivo permanece posterior, conforme solicitado.
