# Memofreq

Jogo web de percepção e memória auditiva: ouça frequências de referência e tente reproduzi-las ajustando um tom contínuo.

**Estado atual: Fase 2 — Domínio e estados concluída.** Configuração, sorteios, pontuação, modelos e máquina de estados estão implementados e testados isoladamente. A aplicação ainda apresenta a tela estática da fundação; áudio, slider e integração jogável serão implementados nas próximas fases. A Fase 3 depende de nova autorização.

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
| `npm run test:run`     | Testes do domínio e componentes, execução única           |
| `npm run build`        | Verificar tipos e gerar `dist/`                           |
| `npm run preview`      | Servir o build localmente                                 |
| `npm run test:e2e`     | Smoke tests do build em Chromium desktop e viewport móvel |
| `npm run check`        | Lint, formatação, testes de componentes, tipos e build    |

O E2E requer um build anterior. Seu servidor de preview é iniciado e encerrado pelo Playwright. A emulação móvel não equivale a um teste em aparelho físico ou com leitor de tela.

## Stack e limites

React, TypeScript estrito, Vite e CSS convencional. Somente React e React DOM são dependências de produção. A Web Audio API nativa será integrada em fase posterior.

Sem backend, contas, persistência remota ou dependências de áudio. Não há implantação de site configurada nesta fase. `base: './'` permite servir o build estático em uma subpasta; se futuramente houver rotas, a estratégia de navegação e o fallback do host precisarão ser revistos.

## Documentação e continuidade

- [Especificação funcional](docs/functional-spec.md): fonte de verdade das mecânicas aprovadas.
- [Arquitetura](docs/architecture.md): limites dos módulos, áudio e interrupções.
- [Acessibilidade auditiva](docs/accessibility.md): política de anúncios e validação com leitores de tela.
- [Plano de implementação](docs/implementation-plan.md): fases, dependências e critérios de aceitação.
- [Testes manuais](docs/manual-testing.md): roteiro e registro explícito das verificações.
- [Relatório da Fase 1](docs/phase-1-report.md): entregas, inventário e verificações executadas.
- [Relatório da Fase 2](docs/phase-2-report.md): domínio, transições e validação das regras.
- [Instruções para agentes](AGENTS.md): regras permanentes para futuras sessões.

Consulte o plano para identificar o estágio atual antes de modificar o projeto. Não avance fases sem autorização do usuário.

## Git e GitHub

Repositório criado: [MatDev435/Memofreq](https://github.com/MatDev435/Memofreq), privado. Branch principal: `main`, com acompanhamento de `origin/main`.

Commits pequenos e coerentes seguem preferencialmente Conventional Commits. Antes de cada commit, execute as verificações relevantes. Não versione dependências instaladas, builds, resultados temporários ou segredos; não faça push forçado.

## Inspiração

O conceito de memória de frequências foi inspirado no [Dialed Sound](https://dialed.gg/sound). Interface, identidade e implementação serão próprias.
