# Relatório da Fase 1 — Fundação

Data: 26/10/2026. Escopo autorizado: somente a Fase 1. A Fase 2 não foi iniciada e continua aguardando autorização.

## Entregas

- Projeto React + TypeScript estrito + Vite, com Node 24 e npm 11.
- Tela estática de apresentação em pt-BR, estilos responsivos e link para pular ao conteúdo.
- ESLint com análise de tipos, Prettier, EditorConfig e exclusão de artefatos gerados.
- Vitest, React Testing Library, user-event e ambiente jsdom.
- Smoke tests do build com Playwright em Chromium desktop e emulação móvel, incluindo axe-core.
- Workflow de CI com ações fixadas por SHA, permissões de leitura e upload de traces apenas em falha.
- Especificação funcional, arquitetura, plano, política de acessibilidade e instruções para próximas sessões.
- Repositório privado `MatDev435/Memofreq` criado após verificar autenticação e inexistência do destino.
- Git local inicializado em `main`, com commits separados por responsabilidade.

Sem implementação antecipada de pontuação, sorteios, reducer, engine de áudio, slider ou modos jogáveis. Os diretórios reservados possuem somente documentação de responsabilidade.

## Arquivos criados

```text
.editorconfig
.gitattributes
.github/workflows/ci.yml
.gitignore
.npmrc
.nvmrc
.prettierignore
.prettierrc.json
AGENTS.md
README.md
docs/accessibility.md
docs/architecture.md
docs/functional-spec.md
docs/implementation-plan.md
docs/manual-testing.md
docs/phase-1-report.md
e2e/foundation.spec.ts
eslint.config.js
index.html
package-lock.json
package.json
playwright.config.ts
src/app/App.test.tsx
src/app/App.tsx
src/application/README.md
src/audio/README.md
src/domain/README.md
src/main.tsx
src/test/setup.ts
src/ui/styles/global.css
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts
```

`node_modules/`, `dist/`, caches e resultados do Playwright são gerados e ignorados pelo Git.

## Verificações efetivamente executadas

| Verificação                                                             | Resultado                                                                   |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Instalação das dependências                                             | Concluída; lockfile gerado                                                  |
| `npm ci --offline --cache=/tmp/memofreq-npm-cache --no-audit --no-fund` | Concluída; reinstalação reproduzível pelo lockfile                          |
| `npm run check`                                                         | Aprovado: lint sem avisos, formatação, testes, tipos e build                |
| Vitest + Testing Library                                                | 2 testes aprovados: apresentação semântica e primeiro foco por teclado      |
| Playwright Chromium desktop                                             | 2 testes aprovados: carregamento/teclado/layout e axe                       |
| Playwright Chromium móvel emulado                                       | 2 testes aprovados: carregamento/teclado/layout e axe                       |
| axe-core no navegador                                                   | Nenhuma violação detectada nas regras WCAG selecionadas, nas duas execuções |
| Build de produção                                                       | Gerado em `dist/` com sucesso                                               |
| `git diff --check` e revisão dos arquivos destinados aos commits        | Sem erros de whitespace ou inclusão de artefatos gerados                    |

Os testes E2E executaram o build servido por Vite preview. Verificaram título, idioma, conteúdo, ausência de exceções JavaScript, salto por teclado ao conteúdo e ausência de overflow horizontal nas duas viewports.

O primeiro E2E não conseguiu iniciar o servidor no sandbox. A execução autorizada fora dele revelou três bibliotecas Linux ausentes. Elas foram baixadas e extraídas somente em `/tmp`, sem instalação no sistema. Após esse ajuste, os quatro casos passaram.

Para reproduzir especificamente neste ambiente enquanto os arquivos temporários existirem:

```sh
export PATH=/home/mat/.nvm/versions/node/v24.21.0/bin:$PATH
export PLAYWRIGHT_BROWSERS_PATH=/tmp/memofreq-playwright
export LD_LIBRARY_PATH=/tmp/memofreq-browser-libs/root/usr/lib/x86_64-linux-gnu
npm run test:e2e
```

Em outro ambiente, siga a instalação padrão do Playwright no README; os caminhos temporários acima não são dependências do projeto ou da CI.

## Decisões documentadas

- Ocultar a página em resultados preserva a partida; na contagem, aguarda retomada explícita; em referência ou tentativa, interrompe por comprometimento da integridade.
- Perda de foco isolada não invalida a partida.
- Sorteio e slider serão logarítmicos, entre 50 e 700 Hz.
- Pontuações, médias e somas conservarão precisão; duas casas decimais apenas na apresentação.
- Hz não será anunciado automaticamente em nenhum modo, inclusive Normal.
- A proposta do slider usa nome estável, texto acessível constante e botões alternativos, com validação real obrigatória nas fases jogáveis.
- Nenhum teste automatizado é apresentado como garantia de silêncio de leitor de tela ou de qualidade perceptual sonora.

## Commits

- `c6d2aff` — `chore: initialize React TypeScript Vite foundation`
- `c01bd86` — `docs: record approved game rules and implementation plan`
- Este relatório é versionado em um commit documental separado.

## GitHub

[Memofreq](https://github.com/MatDev435/Memofreq) foi criado como repositório privado. A autenticação e o escopo `workflow` foram confirmados antes do envio da configuração da CI.

O push foi concluído e a branch `main` acompanha `origin/main`. O workflow foi acionado no GitHub; as execuções e seus logs estão disponíveis em [GitHub Actions — Quality](https://github.com/MatDev435/Memofreq/actions/workflows/ci.yml). As verificações locais efetivamente concluídas estão registradas acima; o resultado da execução remota mais recente deve ser consultado no GitHub.

O helper Git está configurado apenas neste repositório para usar `gh auth git-credential`, sem gravar tokens nos arquivos do projeto. A CI permaneceu versionada e o histórico foi preservado.

## Limites e continuidade

- Não executados: testes de áudio, qualidade sonora ou leitores de tela reais; controles ainda não existem.
- Não executados: Firefox, Safari e dispositivos físicos. A emulação móvel usa Chromium e não comprova compatibilidade nesses ambientes.
- O axe não substitui auditoria manual; o checklist permanece sem marcações não observadas.
- A interface definitiva, o backend e a publicação de site não fazem parte desta fase.
- Próximo trabalho possível: Fase 2, somente após autorização explícita.
