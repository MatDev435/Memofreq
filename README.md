# Memofreq

Jogo web de percepção e memória auditiva: ouça frequências de referência e tente reproduzi-las ajustando um tom contínuo.

**Estado atual: Fase 4 — Normal jogável concluída.** A interface inicial permite testar áudio, ajustar volume e completar cinco rounds do Normal Mode, com slider, teclado e resultados textuais. O acabamento visual definitivo fica para uma etapa própria. Hard e Extreme dependem da autorização da Fase 5; o gráfico permanece previsto para a Fase 6.

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
2. Selecione Normal e pressione **Iniciar partida**. Aguarde os três segundos da contagem e ouça a referência por três segundos, uma única vez.
3. O tom contínuo começa automaticamente. Ajuste pelo slider ou pelos botões **Diminuir tom** e **Aumentar tom**.
4. Confirme a tentativa, consulte o resultado e avance. Após cinco rounds, veja o total e as notas individuais; você pode jogar novamente ou voltar ao início.

No slider, setas ajustam em passos finos, Page Up/Page Down fazem ajustes maiores e Home/End alcançam os extremos. Hz aparece visualmente no Normal, sem região viva ou associação dinâmica ao nome do controle. Resultados são consultáveis sob demanda. Os botões oferecem uma alternativa caso o leitor de tela narre alterações do slider nativo.

Ocultar a aba durante a contagem exige retomada explícita. Durante referência ou tentativa, a partida é interrompida. Em resultados, os dados são preservados. Recarregar a página perde o progresso: não há persistência nesta versão.

## Verificações

```sh
npm run check
npx playwright install chromium
npm run test:e2e
```

Em uma máquina Linux sem as bibliotecas necessárias, a instalação documentada pelo Playwright é `npx playwright install --with-deps chromium`. Essa opção pode exigir privilégios administrativos. A CI instala essas dependências em seu ambiente descartável.

| Comando                | Finalidade                                                |
| ---------------------- | --------------------------------------------------------- |
| `npm run dev`          | Desenvolvimento com Vite                                  |
| `npm run typecheck`    | TypeScript estrito para aplicação, testes e configurações |
| `npm run lint`         | ESLint com regras de TypeScript e React                   |
| `npm run format:check` | Verificar formatação                                      |
| `npm run format`       | Aplicar formatação                                        |
| `npm test`             | Vitest em modo de observação                              |
| `npm run test:run`     | Domínio, engine, controlador e componentes                |
| `npm run build`        | Verificar tipos e gerar `dist/`                           |
| `npm run preview`      | Servir o build localmente                                 |
| `npm run test:e2e`     | Normal completo, acessibilidade e Web Audio nativa        |
| `npm run check`        | Lint, formatação, testes de componentes, tipos e build    |

O E2E requer um build anterior. Seu servidor de preview é iniciado e encerrado pelo Playwright. A emulação móvel não equivale a um teste em aparelho físico ou com leitor de tela.

Os testes completos usam as durações reais de contagem e referência e levam aproximadamente dois minutos nos dois perfis do Chromium. Não há parâmetros de teste expostos na interface nem atalhos de temporização no produto.

## Stack e limites

React, TypeScript estrito, Vite, CSS convencional e engine com Web Audio API nativa. Somente React e React DOM são dependências de produção. O controlador coordena o domínio e a engine; os componentes apresentam estado e enviam ações.

Sem backend, contas, persistência remota ou dependências de áudio. Não há implantação de site configurada nesta fase. `base: './'` permite servir o build estático em uma subpasta; se futuramente houver rotas, a estratégia de navegação e o fallback do host precisarão ser revistos.

## Documentação e continuidade

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
- [Instruções para agentes](AGENTS.md): regras permanentes para futuras sessões.

Consulte o plano para identificar o estágio atual antes de modificar o projeto. Não avance fases sem autorização do usuário.

## Git e GitHub

Repositório criado: [MatDev435/Memofreq](https://github.com/MatDev435/Memofreq), privado. Branch principal: `main`, com acompanhamento de `origin/main`.

Commits pequenos e coerentes seguem preferencialmente Conventional Commits. Antes de cada commit, execute as verificações relevantes. Não versione dependências instaladas, builds, resultados temporários ou segredos; não faça push forçado.

## Inspiração

O conceito de memória de frequências foi inspirado no [Dialed Sound](https://dialed.gg/sound). Interface, identidade e implementação serão próprias.
