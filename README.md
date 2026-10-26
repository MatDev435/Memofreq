# Memofreq

Jogo web de percepção e memória auditiva: ouça frequências de referência e tente reproduzi-las ajustando um tom contínuo.

**Estado atual: Fase 7 — Redesign completo concluído.** As quatro telas foram recriadas a partir dos oito mockups desktop/mobile: menu, gameplay, resumo do round e resultado final. O jogo mantém as regras e o áudio existentes, com indicadores circulares, gráfico, detalhes consultáveis e movimento reduzido. Veja o [relatório com capturas](docs/phase-7-report.md).

## Requisitos

- Node.js 24 LTS; versão de referência em `.nvmrc`.
- npm 11.
- Navegador moderno.

Com nvm instalado, execute `nvm install` e `nvm use`. Caso `node` ou `npm` não sejam encontrados, carregue o nvm no shell antes de continuar. Não é necessário instalar ferramentas globalmente.

## Instalação e execução

```sh
npm ci
npm run dev
```

O servidor de desenvolvimento imprime a URL local, normalmente `http://127.0.0.1:5173`.

## Testar áudio e jogar

1. Abra a URL local no navegador. Use **Testar áudio** e ajuste **Volume** para um nível confortável; fones são recomendados.
2. Selecione **Normal**, **Hard** ou **Extreme**. No Extreme, escolha duas ou três referências antes de iniciar; essa quantidade fica fixa durante a partida. A contagem dura três segundos. Normal apresenta uma referência de três segundos; Hard apresenta uma de 1,5 s; Extreme apresenta a sequência inteira de referências de 1,5 s com pausas de 300 ms.
3. O tom contínuo começa automaticamente. Ajuste pelo slider ou pelos botões **Diminuir tom** e **Aumentar tom**.
4. Confirme a tentativa, consulte o resultado e avance. No Extreme, cada confirmação passa automaticamente ao próximo palpite, sorteando outra posição do slider sem interromper o tom. Após a última resposta, consulte todos os alvos, palpites e pontos juntos, com a média do round. Após cinco rounds, veja o total, o gráfico com escala fixa de zero a dez e a tabela de notas; **Jogar novamente** preserva modalidade e quantidade, com novos sorteios.

O botão **Animações visuais** pausa os efeitos decorativos; a preferência de movimento reduzido do sistema também é respeitada. A tipografia Inter é servida pelo próprio build, sem requisições a fontes externas.

No slider, setas ajustam em passos finos, Page Up/Page Down fazem ajustes maiores e Home/End alcançam os extremos. Hz aparece visualmente apenas no Normal, sem região viva ou associação dinâmica ao nome do controle. Hard e Extreme omitem o texto de frequência durante as tentativas, inclusive em nomes e descrições acessíveis. Resultados são consultáveis sob demanda. Os botões oferecem uma alternativa caso o leitor de tela narre alterações do slider nativo.

Ocultar a aba durante a contagem exige retomada explícita. Durante referência ou tentativa, a partida é interrompida. Em resultados, os dados são preservados. Recarregar a página perde o progresso: não há persistência nesta versão.

## Verificações

```sh
npm run check
npx playwright install chromium firefox webkit
npm run test:e2e
```

Em uma máquina Linux sem as bibliotecas necessárias, a instalação documentada pelo Playwright é `npx playwright install --with-deps chromium firefox webkit`. Essa opção pode exigir privilégios administrativos. A CI instala essas dependências em seu ambiente descartável.

| Comando                | Finalidade                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| `npm run dev`          | Desenvolvimento com Vite                                                |
| `npm run typecheck`    | TypeScript estrito para aplicação, testes e configurações               |
| `npm run lint`         | ESLint com regras de TypeScript e React                                 |
| `npm run format:check` | Verificar formatação                                                    |
| `npm run format`       | Aplicar formatação                                                      |
| `npm test`             | Vitest em modo de observação                                            |
| `npm run test:run`     | Domínio, engine, controlador e componentes                              |
| `npm run build`        | Verificar tipos e gerar `dist/`                                         |
| `npm run preview`      | Servir o build localmente                                               |
| `npm run test:e2e`     | Modalidades, três engines de navegador, build estático e acessibilidade |
| `npm run check`        | Lint, formatação, testes de componentes, tipos e build                  |

O E2E requer um build anterior. O Playwright gerencia dois servidores locais: Vite preview na porta 4173 e arquivos estáticos em `/memofreq/` na porta 4174. A suíte cobre Chromium desktop, Pixel 7 emulado, Firefox e WebKit no Linux. WebKit no Linux e emulação móvel não equivalem a Safari em macOS/iOS ou a aparelhos físicos.

Um Linux sem dispositivo de áudio pode precisar de uma saída virtual para os testes nativos de Firefox/WebKit. A CI instala PulseAudio, cria uma saída nula e mantém o relógio real dos navegadores; isso não equivale a escuta humana. Detalhes do ambiente local ficam no relatório da Fase 6.

Os testes completos usam as durações reais de contagem e referência e levam alguns minutos nos quatro perfis de navegador; os quatro perfis de modalidade são exercitados com dois workers. Não há parâmetros de teste expostos na interface nem atalhos de temporização no produto.

O usuário testou a interface Normal e relatou funcionamento com NVDA em 26/10/2026. Ele também testou e aprovou a correção do fluxo Extreme antes de autorizar a Fase 6. Os próximos testes manuais de áudio e leitores de tela ficam a cargo dele; os testes automatizados não substituem essa avaliação.

## Stack e limites

React, TypeScript estrito, Vite, CSS convencional e engine com Web Audio API nativa. Somente React e React DOM são dependências de produção. O controlador coordena o domínio e a engine; os componentes apresentam estado e enviam ações.

Sem backend, contas, persistência remota ou dependências de áudio. O build estático é validado localmente em uma subpasta; a publicação em um host remoto ainda não está configurada. Veja o [guia de hospedagem](docs/deployment.md). `base: './'` permite servir o build estático em uma subpasta; se futuramente houver rotas, a estratégia de navegação e o fallback do host precisarão ser revistos.

## Documentação e continuidade

- [Redesign da Fase 7 e capturas das quatro telas](docs/phase-7-report.md).
- [Plano por tela e referências da Fase 7](docs/phase-7-plan.md).

- [Relatório consolidado com capturas da interface](docs/visual-report.md): mudanças das Fases 1 a 4, seis imagens reais, testes, commits e pendências.
- [Especificação funcional](docs/functional-spec.md): fonte de verdade das mecânicas aprovadas.
- [Arquitetura](docs/architecture.md): limites dos módulos, áudio e interrupções.
- [Acessibilidade auditiva](docs/accessibility.md): política de anúncios e validação com leitores de tela.
- [Engine de áudio](docs/audio-engine.md): contrato, ciclo de vida e roteiro de escuta manual.
- [Plano de implementação](docs/implementation-plan.md): fases, dependências e critérios de aceitação.
- [Testes manuais](docs/manual-testing.md): roteiro e registro explícito das verificações.
- [Relatório da Fase 1](docs/phase-1-report.md): entregas, inventário e verificações executadas.
- [Relatório da Fase 2](docs/phase-2-report.md): domínio, transições e validação das regras.
- [Relatório da Fase 3](docs/phase-3-report.md): engine e testes de áudio executados.
- [Relatório da Fase 4](docs/phase-4-report.md): Normal jogável, interface e validações.
- [Relatório da Fase 5](docs/phase-5-report.md): entrega inicial de Hard e Extreme.
- [Correção do fluxo Extreme](docs/extreme-flow-fix.md): palpites sem interrupção, resultados conjuntos e capturas atualizadas.
- [Relatório da Fase 6](docs/phase-6-report.md): gráfico, compatibilidade, build estático, verificações e capturas.
- [Hospedagem estática](docs/deployment.md): build, subpastas e validação técnica local.
- [Instruções para agentes](AGENTS.md): regras permanentes para futuras sessões.

Consulte o plano para identificar o estágio atual antes de modificar o projeto. Não avance fases sem autorização do usuário.

## Git e GitHub

Repositório criado: [MatDev435/Memofreq](https://github.com/MatDev435/Memofreq), privado. Branch principal: `main`, com acompanhamento de `origin/main`.

Commits pequenos e coerentes seguem preferencialmente Conventional Commits. Antes de cada commit, execute as verificações relevantes. Não versione dependências instaladas, builds, resultados temporários ou segredos; não faça push forçado.

## Inspiração

O conceito de memória de frequências foi inspirado no [Dialed Sound](https://dialed.gg/sound). Interface, identidade e implementação serão próprias.
