# Instruções permanentes — Memofreq

## Escopo e fonte de verdade

- Leia `README.md`, `docs/functional-spec.md`, `docs/architecture.md`, `docs/accessibility.md` e `docs/implementation-plan.md` antes de trabalhar.
- A especificação funcional registra as regras aprovadas. Não altere mecânicas sem autorização explícita do usuário.
- Execute somente a fase autorizada. Ao concluí-la, informe entregas, verificações reais, pendências, commits e sincronização com o GitHub; aguarde autorização antes da próxima fase.
- A **Fase 3 — Engine de áudio** foi autorizada em 26/10/2026 e está concluída, assim como as Fases 1 e 2. A Fase 4 não está autorizada.
- Na Fase 3, implemente a engine, seu contrato, testes e documentação. Não antecipe a integração jogável com React ou os controles da Fase 4.
- Não implemente backend, autenticação, ranking, desafio diário, banco de dados, persistência remota ou serviços fictícios sem solicitação.

## Engenharia

- Mantenha TypeScript estrito; não use `any`, supressões ou casts para esconder erros.
- Separe domínio puro, coordenação de aplicação, Web Audio API e apresentação React. Não crie abstrações sem uso concreto.
- Preserve a SPA e o build para hospedagem estática. Não adicione dependências sem necessidade justificada.
- Não altere faixa 50–700 Hz, escala logarítmica, cinco rounds, pontuação em cents ou tempos aprovados sem autorização.
- Preserve precisão interna. Arredonde apenas a apresentação, com duas casas decimais e localidade pt-BR.
- Mantenha cancelamento idempotente, identificação das execuções e proteção contra eventos antigos quando o áudio for implementado.
- Troca de aba em resultados não invalida partidas. Siga a tabela por estado na arquitetura; não aplique invalidação global em `visibilitychange`.

## Acessibilidade

- Preserve HTML semântico, foco visível, teclado e operação com tecnologia assistiva.
- Não anuncie Hz automaticamente em nenhum modo ou etapa. Nome estável do controle: “Ajustar tom”.
- Não anuncie continuamente movimentos, números ou regiões de altura como “grave”, “intermediária” e “aguda”.
- No Normal, Hz poderá aparecer visualmente em região não viva. Hard e Extreme ocultam Hz durante tentativas.
- Resultados terão frequências acessíveis sob demanda, fora de regiões vivas e sem foco automático nos valores.
- Mantenha anúncios curtos das etapas fora dos tons. Nenhuma API web garante controlar a fila de fala de um leitor de tela.
- Não esconda o slider inteiro da árvore acessível, não remova suas informações obrigatórias e não use `role="application"` para contornar anúncios.
- Valide controles com leitores de tela reais nas fases jogáveis; axe e Playwright não substituem essa verificação.

## Qualidade e documentação

- Execute `npm run check` antes de concluir uma entrega. Para mudanças de interface ou configuração E2E, rode build e `npm run test:e2e` quando o ambiente permitir.
- Escreva testes para invariantes e comportamentos relevantes. Não confunda mocks de áudio com qualidade sonora real.
- Se uma verificação não puder ser executada, registre o motivo, sem declarar aprovação.
- Atualize especificação, arquitetura, plano e checklist quando decisões ou estado da implementação mudarem.
- Não marque itens de testes manuais como concluídos sem execução observada.

## Git e segurança

- Inspecione arquivos e alterações preexistentes; preserve o trabalho de outras pessoas.
- Use commits pequenos e semanticamente coerentes, preferencialmente Conventional Commits.
- Mantenha `package-lock.json` versionado e use `npm ci` para instalações reproduzíveis.
- Não versione segredos, `.env`, tokens, dependências instaladas, builds ou relatórios temporários.
- Verifique a autenticação e a identidade do remoto antes de sincronizar. Não exponha tokens em arquivos, argumentos ou logs.
- Não sobrescreva repositórios não relacionados e não use push forçado sem autorização.
