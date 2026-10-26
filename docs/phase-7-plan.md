# Fase 7 — plano do redesign por tela

Autorizada pelo usuário após a Fase 6. Implementação sequencial: menu inicial, gameplay, resumo do round e resultado da partida. O escopo inclui as quatro telas; a separação organiza o desenvolvimento e a revisão, sem novas aprovações entre elas.

## Referências analisadas antes da implementação

As oito imagens foram encontradas em `/mnt/c/Users/Matheus/Downloads/`, equivalentes aos caminhos Windows fornecidos. Os originais foram preservados sem edição em `docs/references/phase-7/`. Cada par desktop/mobile foi inspecionado: Main Menu, Playing, Round Result e Game Result. As molduras de celular, barra de status e indicador do sistema são apresentação do mockup, não componentes da SPA.

- Base quase preta e azul-marinho; painéis com bordas azuladas, roxo e ciano luminosos, âmbar no Hard e em destaques de pontuação.
- Tipografia sem serifa, marca com sinal de áudio e gradiente no sufixo; hierarquia ampla na inicial e compacta durante a partida.
- Desktop com composição horizontal e cards em colunas; mobile com reorganização vertical e controles maiores.
- Ondas e malhas decorativas serão SVG/CSS próprios, sem rasterizar telas ou sobrepor imagens aos controles.

## Ordem de desenvolvimento

1. **Menu inicial:** tokens visuais, marca, ícones, ondas, hero, teste/volume, três cards de modalidade, escolha de duas/três referências, CTA e orientação de escuta/teclado. Revisar desktop/mobile antes da próxima tela.
2. **Gameplay:** inicial removida do DOM ao jogar; cabeçalho compacto com modo real, volume e saída; progresso dos cinco rounds e das tentativas; estágio/contagem/referências; onda, slider nativo, botões e atalhos. Manter os mesmos comandos e início automático.
3. **Resumo do round:** indicador circular por tentativa, alvo/resposta/diferença em Hz e cents, média real e detalhes consultáveis; uma frequência no Normal/Hard, duas/três no Extreme. Nenhuma revelação intermediária no Extreme.
4. **Resultado final:** total real de cinquenta, indicador circular, gráfico 0–10, tabela com notas individuais quando houver múltiplas frequências, detalhes dos rounds e ações existentes. Uma coluna de frequência no Normal/Hard; duas/três no Extreme; o resultado do round é a média, não a soma.

## Regras de adaptação

Números, médias, totais e cents inconsistentes nos exemplos serão substituídos pelos valores do domínio. Seleção de modo/quantidade e volume continuam com seus valores reais; o exemplo visual de 50% não altera o volume inicial aprovado. A configuração do Extreme pode permanecer visível e desabilitada nos outros modos, explicando sua aplicabilidade.

Nenhum arquivo de domínio, controlador, hook de ciclo de vida ou engine será alterado para adaptar o layout. A UI continua usando snapshots e ações existentes. Detalhes técnicos usarão controles de divulgação sem alterar resultados, áudio ou navegação.

## Movimento e acessibilidade

- Animações de apresentação, seleção, hover/foco, ondas, indicadores e barras, sem controlar contagem, som ou avanço. Dados numéricos sempre reais; sem contagem animada de texto.
- Respeitar `prefers-reduced-motion` e oferecer controle de animações decorativas. Efeitos dispensáveis não devem causar processamento por frame no React ou fornecer pistas do alvo.
- Preservar nomes acessíveis, semântica nativa, teclado, foco e região viva curta. Não publicar Hz em nomes/descrições ou anúncios; Hard/Extreme sem Hz durante palpites.
- Decoração com `aria-hidden`, resultados disponíveis sob demanda, contraste verificável e reflow a 320 px/texto ampliado.
- Testes manuais com NVDA continuam com o usuário; nenhuma tentativa de operar leitores de tela pelo agente.

## Verificação e entregas

Checks existentes, testes de componentes, E2E nos quatro perfis de navegador, axe, reflow, movimento reduzido e build estático. Adaptar seletores quando a apresentação passar a incluir detalhes adicionais, mantendo as verificações de mecânica. Capturas reais por tela em desktop/mobile, inspeção comparativa com as referências, commits organizados por tela e relatório persistente. Backend e publicação remota permanecem fora do escopo.

## Entrega por tela

| Etapa           | Commit    | Revisão                                                                |
| --------------- | --------- | ---------------------------------------------------------------------- |
| Menu inicial    | `ac1c5bf` | Referências desktop/mobile, cards, áudio, teclado e fonte local        |
| Gameplay        | `aa83ca1` | Controles nativos, mesmo foco entre palpites, status e onda decorativa |
| Resumo do round | `da89c83` | Um/dois/três cards, anéis, Hz/cents e nota real                        |
| Resultado final | `f606d99` | Total, gráfico, notas por frequência, médias e detalhes                |

As quatro etapas foram implementadas na ordem solicitada, com checks e capturas intermediários. A revisão final acrescentou abreviação visual da tabela estreita (nome acessível completo), layout de cards relativo ao tamanho do texto, teste de limites do número dentro do anel e capturas com animações finitas concluídas. Evidências consolidadas em `phase-7-report.md`.
