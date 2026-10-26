# Instruções permanentes — Memofreq

## Escopo e fonte de verdade

- Leia `README.md`, `docs/functional-spec.md`, `docs/architecture.md`, `docs/accessibility.md` e `docs/implementation-plan.md` antes de trabalhar.
- A especificação funcional registra as regras aprovadas. Não altere mecânicas sem autorização explícita do usuário.
- Execute somente a fase autorizada. Ao concluí-la, informe entregas, verificações reais, pendências, commits e sincronização com o GitHub; aguarde autorização antes da próxima fase.
- As Fases 1 a 5 estão concluídas. O usuário testou e aprovou a correção do Extreme. A **Fase 6 — Integração e qualidade** foi autorizada em 26/10/2026 e está concluída.
- Correção do Extreme autorizada em 26/10/2026: cada confirmação intermediária registra o palpite e passa automaticamente ao próximo, sorteando outra posição no mesmo tom contínuo, sem resultados, pausa, anúncios ou botão de continuar. Revelar todos os alvos, palpites e notas juntos somente após a última confirmação e apresentar a média do round.
- A Fase 6 inclui gráfico dos cinco rounds com eixo 0–10, tabela equivalente, revisão de integração, compatibilidade, reflow e validação local do build estático. O acabamento visual definitivo e funcionalidades futuras exigem nova autorização.
- A Fase 7 — Redesign completo está concluída e foi autorizada com oito referências desktop/mobile. As telas foram desenvolvidas na ordem menu, gameplay, resumo do round, resultado final, conforme `docs/phase-7-plan.md`. Preservar integralmente domínio, controlador, engine, áudio e navegação; adaptar a apresentação aos modos reais e aos valores corretos, mesmo quando o mockup divergir.
- A Fase 7 preservou domínio, controlador, hook e engine; validou 181 testes Vitest e 60 E2E nos quatro perfis. Evidências e capturas em `docs/phase-7-report.md`. O teste manual do redesign com NVDA continua com o usuário; novas funcionalidades exigem autorização.
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
- O usuário relatou funcionamento do Normal com NVDA em 26/10/2026 e assumiu os próximos testes manuais com leitores de tela. Não tente operar o NVDA nem outras ferramentas de leitor por conta própria; mantenha os testes automatizados e o roteiro manual para o usuário. Registre os relatos como validação do usuário, sem inventar versões, passos ou compatibilidade universal.

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
