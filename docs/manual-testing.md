# Checklist de testes manuais

Um item só pode ser marcado como executado após observação real. Registre data, ambiente, passos, resultado e limitações. Testes automatizados não marcam este checklist automaticamente.

## Fundação

- [ ] Abrir o projeto em navegador e inspecionar a página visualmente.
- [ ] Conferir apresentação em viewport estreito, desktop e zoom de 200%.
- [ ] Usar Tab e Enter para alcançar “Ir para o conteúdo”.
- [ ] Conferir foco visível, contraste e legibilidade.
- [ ] Inspecionar a página com um leitor de tela real, sem inferir o resultado a partir do axe.

## Áudio — após implementação da engine

Use diretamente Testar áudio, Volume e as partidas Normal, Hard ou Extreme. Os próximos testes manuais serão executados pelo usuário, conforme sua orientação em 26/10/2026. Roteiro: [engine de áudio](audio-engine.md#roteiro-de-escuta-manual). A disponibilidade de testes nativos e renderização PCM automatizada não marca estes itens como escuta humana.

- [ ] Habilitar som por ação explícita, inclusive em Safari/iOS.
- [ ] Testar volume inicial confortável e controle de volume.
- [ ] Ouvir tons em diferentes posições da faixa, com fones.
- [ ] Avaliar envelopes e ausência de estalos na entrada, saída e movimento rápido.
- [ ] Verificar que mover o slider não reinicia o tom.
- [ ] Verificar que a confirmação encerra o som suavemente.
- [ ] Ouvir sequência Extreme e pausas, sem sobreposição de tons.
- [ ] Encerrar e reiniciar repetidamente; nenhum som permanece ou duplica.
- [ ] Testar suspensão pelo sistema, bloqueio da tela e restauração do contexto.

## Regras e interrupções — após experiência jogável

- [ ] Completar cinco rounds do Normal e Hard.
- [ ] Completar cinco rounds do Extreme com duas e três referências.
- [ ] Confirmar com duplo clique ou Enter mantido; não registrar involuntariamente o próximo palpite do Extreme.
- [ ] No Extreme, confirmar o primeiro palpite e verificar nova posição do slider na mesma voz, sem pausa, resultado, anúncio ou botão de continuar.
- [ ] Após o último palpite, conferir alvo, resposta, diferença e nota de todas as frequências, junto da média do round.
- [ ] Ocultar a página após um palpite intermediário do Extreme: interromper a partida, pois o próximo já está ativo.
- [ ] Verificar ausência de replay e impossibilidade de alterar resposta anterior.
- [ ] Ocultar página na contagem: aguardar ação explícita e recomeçar três segundos, sem ter tocado referência.
- [ ] Ocultar página durante referência: interromper a partida sem replay.
- [ ] Ocultar página durante tentativa: interromper a partida e parar tom.
- [ ] Ocultar página no resultado completo do round: preservar dados e permitir continuar.
- [ ] Ocultar página no resultado final: preservar dados.
- [ ] Apenas desfocar a janela sem ocultar a página: não invalidar automaticamente.
- [ ] Voltar de resultado com contexto suspenso: habilitar por interação antes de avançar, sem repetir referência.
- [ ] Conferir totais e médias sem arredondamento intermediário, exibidos com duas casas em pt-BR.

## Acessibilidade auditiva — fases jogáveis

- [ ] Nome estável “Ajustar tom” em todos os modos.
- [ ] Setas, Home/End e ajustes maiores funcionam conforme instruções.
- [ ] Botões alternativos ajustam o mesmo tom sem mudar foco ou nome.
- [ ] Nenhum Hz é anunciado automaticamente durante ajuste no Normal, Hard ou Extreme.
- [ ] Nenhuma região de altura é narrada durante movimento.
- [ ] Registrar anúncios nativos persistentes do slider e testar a alternativa por botões.
- [ ] Hz aparece visualmente apenas no Normal durante a tentativa.
- [ ] Resultados não anunciam alvo/resposta automaticamente e permitem consulta intencional.
- [ ] Não há mensagem disparada pela aplicação sobre os tons de referência ou tentativa.
- [ ] Round, tentativa e ações disponíveis são compreensíveis por leitor de tela.
- [ ] Consultar gráfico e tabela final com cinco notas equivalentes, sem foco ou anúncio automático dos valores.
- [ ] Conferir inicial, tentativa e resultados com zoom real de 200% e texto ampliado, em desktop e aparelho físico.

Use a matriz detalhada de `accessibility.md`, com versões de NVDA/VoiceOver/TalkBack e navegadores. Não declarar compatibilidade universal a partir de uma única combinação.

## Compatibilidade

- [ ] Chrome desktop.
- [ ] Firefox desktop.
- [ ] Safari macOS.
- [ ] Safari iOS em dispositivo físico.
- [ ] Chrome Android em dispositivo físico.
- [ ] Mouse, toque e teclado.

## Registro de execução

Até a entrega da Fase 4, o agente não havia realizado escuta humana ou observado fala de leitor de tela. Os controles agora existem. O NVDA foi localizado, mas a ferramenta Windows falhou na inicialização por incompatibilidade do caminho Linux/Windows; detalhes em `accessibility.md`.

Foram inspecionadas visualmente capturas do Chromium desktop e Pixel 7 emulado. Testes automatizados verificaram teclado, foco, axe e partidas completas. As transições de visibilidade no E2E foram provocadas por eventos controlados; isso não equivale a uma validação manual de troca de aba em todos os sistemas. Após a entrega, o usuário relatou teste geral bem-sucedido da interface Normal, inclusive com NVDA, em 26/10/2026. Navegador, versões e casos específicos não foram informados; por isso, esse relato é registrado sem marcar individualmente os itens acima. Os próximos testes manuais de áudio e leitores de tela ficam com o usuário, inclusive Hard e Extreme; o agente não tentará operar o NVDA.

| Data       | Ambiente e versões                                            | Caso                                          | Resultado observado                                                 | Pendência                                                                                                |
| ---------- | ------------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 26/10/2026 | Chromium / Pixel 7 emulado, capturas Playwright               | Inspeção visual                               | Conteúdo legível e controles sem corte horizontal nas capturas      | Escuta humana, aparelhos físicos e leitores de tela reais                                                |
| 26/10/2026 | Ambiente do usuário; NVDA; navegador e versões não informados | Teste geral da interface Normal após a Fase 4 | Usuário relatou funcionamento, inclusive com NVDA                   | Casos específicos não discriminados; novos modos ainda aguardam teste manual do usuário                  |
| 26/10/2026 | Ambiente do usuário; navegador e versões não informados       | Fluxo Extreme após a correção                 | Usuário relatou que testou e agora está correto; autorizou a Fase 6 | Quantidade de referências e casos de acessibilidade não discriminados; gráfico novo aguarda teste manual |
