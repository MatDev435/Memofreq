# Plano de implementação

Planejamento aprovado em 26/10/2026. Cada fase exige sua própria autorização. Não executar a próxima fase apenas porque a anterior terminou.

## Situação atual

| Fase                       | Estado                   | Autorização              |
| -------------------------- | ------------------------ | ------------------------ |
| 1 — Fundação               | Concluída e sincronizada | Autorizada               |
| 2 — Domínio e estados      | Concluída                | Autorizada em 26/10/2026 |
| 3 — Engine de áudio        | Concluída                | Autorizada em 26/10/2026 |
| 4 — Normal jogável         | Não iniciada             | Aguardando autorização   |
| 5 — Hard e Extreme         | Não iniciada             | Aguardando autorização   |
| 6 — Integração e qualidade | Não iniciada             | Aguardando autorização   |

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

**Aceitação:** completar partida, reiniciar e voltar à inicial sem som remanescente; alvos nunca podem ser repetidos; inicialização com distância mínima; teclado completo; Hz visual sem região viva; dados do resultado consultáveis sob demanda. Testes integrados e E2E. Executar e registrar testes reais do slider com leitor de tela disponível; documentar incompatibilidades e alternativas.

## Fase 5 — Hard e Extreme

**Dependência:** Normal integrado e autorização da fase.

**Entregas:** Hard com referência de 1,5 s, Extreme de duas ou três referências, pausas de 300 ms, tentativas sequenciais, valores ocultos e médias.

**Aceitação:** cinco rounds em cada modalidade; quantidade fixa durante a partida; valores ocultos também nos metadados acessíveis durante tentativas; respostas em ordem; posição inicial por tentativa; resultados imutáveis; médias sem arredondamento prévio. Cobrir teclado, leitores de tela e interrupções durante sequências e entre resultados.

## Fase 6 — Integração e qualidade

**Dependência:** três modos completos e autorização da fase.

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
