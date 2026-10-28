# Plano de implementação

Planejamento aprovado em 26/10/2026. Cada fase exige sua própria autorização. Não executar a próxima fase apenas porque a anterior terminou.

## Situação atual

| Fase                       | Estado                   | Autorização              |
| -------------------------- | ------------------------ | ------------------------ |
| 1 — Fundação               | Concluída e sincronizada | Autorizada               |
| 2 — Domínio e estados      | Concluída                | Autorizada em 26/10/2026 |
| 3 — Engine de áudio        | Concluída                | Autorizada em 26/10/2026 |
| 4 — Normal jogável         | Concluída                | Autorizada em 26/10/2026 |
| 5 — Hard e Extreme         | Concluída                | Autorizada em 26/10/2026 |
| 6 — Integração e qualidade | Concluída                | Autorizada em 26/10/2026 |
| 7 — Redesign completo      | Concluída                | Autorizada em 26/10/2026 |

## Fase 1 — Fundação

**Entregas:**

- Inspeção dos arquivos preexistentes e Git.
- React, TypeScript estrito, Vite, HTML pt-BR e CSS mínimo responsivo.
- Tela estática de apresentação, sem funcionalidades de partida.
- Estrutura inicial documentada para domínio, aplicação e áudio.
- ESLint, Prettier, tipos, Vitest, Testing Library e infraestrutura E2E Playwright/axe.
- CI com instalação reproduzível, checks, build e smoke tests.
- README, AGENTS, especificação funcional, arquitetura, acessibilidade, plano e checklist manual.
- Repositório privado `Memofreq`, branch `main`, commits coerentes e push quando disponível.

**Aceitação:** instalação pelo lockfile; tipos, lint, formatação, testes iniciais e build aprovados; smoke test do build executado quando o ambiente permitir; documentação fiel às decisões; sincronização e pendências informadas.

**Fora da fase:** implementação de regras, sorteio, pontuação, reducer, áudio, slider, modos jogáveis ou resultados. Os documentos podem especificá-los, sem código executável antecipado.

## Fase 2 — Domínio e estados

**Dependência:** Fase 1 aprovada e autorização explícita para iniciar.

**Entregas:** configuração central, modelos, modalidades, sorteio logarítmico, distância mínima, pontuação pura e reducer com eventos identificados. Formalizar estados de contagem interrompida e preservação de resultados.

**Aceitação:** testes para faixa, decimais, valores inválidos, posições iniciais válidas inclusive nos extremos, cinco rounds, modos, tempos configurados, médias, soma sem arredondamento e transições. Impedir replay, confirmações duplicadas, edição de resposta e avanço prematuro. Ainda sem engine ou fluxo jogável.

## Fase 3 — Engine de áudio

**Dependência:** contratos definidos e nova autorização. A configuração e os modelos da Fase 2 orientam os parâmetros; a engine permanece independente dos modos.

**Entregas:** habilitação do contexto, teste de áudio, tons senoidais, referências e sequências agendadas, tom contínuo, atualização suave, volume, cancelamento e descarte. Um contrato pequeno permite controlar a engine em testes.

**Aceitação:** verificar horários, envelopes, sequência, ausência de recriação por atualização, cancelamento de nós futuros, listeners e timers, idempotência, suspensão e eventos antigos. Executar avaliação sonora manual quando houver saída disponível; registrar o que não foi ouvido. Não tratar chamadas mockadas como validação perceptual.

## Fase 4 — Normal jogável

**Dependências:** domínio e engine aprovados; autorização da fase.

**Entregas:** tela inicial mínima funcional, volume/teste, cinco rounds do Normal, slider logarítmico, confirmação, resultados individuais e total textual. Implementar política de interrupção e acessibilidade de controle.

**Aceitação:** completar partida, reiniciar e voltar à inicial sem som remanescente; alvos nunca podem ser repetidos; inicialização com distância mínima; teclado completo; Hz visual sem região viva; dados do resultado consultáveis sob demanda. Testes integrados e E2E. Registrar testes reais do slider com leitor de tela; documentar incompatibilidades e alternativas. O usuário relatou funcionamento com NVDA e assumiu as próximas verificações manuais em 26/10/2026.

## Fase 5 — Hard e Extreme

**Dependência:** Normal integrado e autorização da fase.

**Entregas:** Hard com referência de 1,5 s, Extreme de duas ou três referências, pausas de 300 ms, tentativas sequenciais, valores ocultos e médias.

**Aceitação:** cinco rounds em cada modalidade; quantidade fixa durante a partida; valores ocultos também nos metadados acessíveis durante tentativas; respostas em ordem; posição inicial por tentativa; resultados imutáveis; médias sem arredondamento prévio. Cobrir teclado, estrutura acessível e interrupções durante sequências e entre resultados. Os testes manuais com leitores de tela serão realizados pelo usuário, conforme sua orientação em 26/10/2026; não tentar operar NVDA automaticamente.

Correção autorizada em 26/10/2026 após teste do usuário: palpites do Extreme passam automaticamente ao seguinte na mesma voz contínua, sem resultados intermediários. O resultado do round revela todas as frequências, palpites, diferenças, notas e média juntos. O registro da correção e das verificações fica em [correção do Extreme](extreme-flow-fix.md).

## Fase 6 — Integração e qualidade

**Dependência:** três modos completos e autorização da fase. O usuário testou e aprovou o Extreme corrigido antes de autorizar a Fase 6 em 26/10/2026.

**Entregas:** gráfico de cinco barras com eixo 0–10 e tabela equivalente, revisão conjunta, compatibilidade, responsividade e correções funcionais. Sem projeto visual definitivo.

**Aceitação:** integração dos quatro perfis de modalidade, resultados consistentes, implantação estática tecnicamente validada, ausência de regressões conhecidas e relatórios dos testes automáticos/manuais. Registrar navegadores, dispositivos e leitores testados e pendências reais.

## Encerramento de cada fase

1. Revisar escopo e documentação.
2. Executar checks pertinentes e corrigir falhas observadas.
3. Registrar verificações executadas e limites de validação.
4. Criar commits pequenos e coerentes, sem segredos ou artefatos gerados.
5. Sincronizar a branch quando possível e verificar o estado remoto.
6. Apresentar relatório e aguardar autorização para avançar.

## Futuro, sem implementação autorizada

Autenticação, persistência remota, estatísticas, rankings por modalidade e desafio diário. Não criar APIs falsas ou abstrações genéricas para essas possibilidades.

## Fase 7 — Redesign completo

**Autorização:** recebida com oito imagens de referência, após a Fase 6. Ordem solicitada: menu inicial, gameplay, resumo do round e resultado final. Não exige novas aprovações entre essas quatro telas.

**Entregas:** identidade permanente escura, roxo/ciano, fonte local, marca e elementos SVG reutilizáveis; composição responsiva fiel aos mockups; anéis e gráfico animados; controle de movimento e respeito à preferência do sistema; manutenção de áudio, regras, foco, teclado e anúncios; resultados adaptados ao modo e quantidade reais; testes, capturas e relatório persistente.

**Aceitação:** preservar os arquivos de domínio, controlador, hook e engine; passar nos checks existentes e novos testes de apresentação/reflow; validar as quatro modalidades nos quatro perfis de navegador; capturar e revisar desktop/mobile das quatro telas. NVDA e escuta humana continuam com o usuário.

**Andamento por tela:** as quatro telas e a revisão final estão concluídas; 181 testes de unidade/componentes e 60 E2E aprovados, com capturas e relatório persistentes. Ver `phase-7-plan.md` e `phase-7-report.md`.

## Ajuste após a Fase 7 — layout compacto

Autorizado e aprovado manualmente pelo usuário em 27/10/2026. Escopo: compactar menu, gameplay e resultados, principalmente no mobile, preservando identidade visual, ordem dos elementos e mecânicas. A primeira entrega ficou local, sem testes ou commit, conforme solicitado. Após a aprovação, o usuário autorizou as verificações automatizadas e o commit. Evidências de validação ficam em `compact-layout-report.md`; o relato manual está no checklist.

**Conclusão:** layout aprovado pelo usuário; `npm run check` e 60 E2E aprovados em 27/10/2026. Nenhuma correção adicional necessária. Commit local autorizado; push não realizado nesta entrega.

## Atualização autorizada — timbre aditivo e faixa 80–700 Hz

Autorização de 28/10/2026: substituir o timbre conforme os parâmetros fornecidos, ajustar somente o mínimo da frequência base para 80 Hz, preservar mecânicas, interface e controles; executar testes e, se aprovados, fazer commit e push na branch atual. Configuração e contrato técnico em `audio-engine.md`. Validação e limites em `additive-timbre-report.md`.

**Conclusão em 28/10/2026:** preset implementado, faixa base atualizada para 80–700 Hz e interface preservada. `npm run check` aprovado com 192 testes; 60 E2E aprovados nos quatro perfis. Commit e push autorizados na `main`; escuta humana do novo timbre permanece pendente com o usuário.
