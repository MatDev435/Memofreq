# Acessibilidade e preservação da escuta

## Requisito aprovado

O desafio é auditivo. Em todos os modos, inclusive Normal, a aplicação não deve emitir anúncios automáticos de Hz nem narrar continuamente o slider. Também não deve anunciar regiões de altura, como “grave”, “intermediária” ou “aguda”, durante o ajuste.

Isso não elimina a operação por tecnologia assistiva: o controle permanece identificável, ajustável e com alternativa de operação. Resultados numéricos continuam acessíveis para leitura intencional.

As Fases 4 e 5 implementam o controle e a política de anúncios em Normal, Hard e Extreme. A semântica, teclado, foco e regiões vivas são verificados automaticamente. Em 26/10/2026, o usuário relatou funcionamento do Normal com NVDA e assumiu os próximos testes manuais com leitores de tela; o agente não deve tentar operar o NVDA. Navegador, versões e passos específicos desse teste não foram informados. A engine não publica anúncios nem altera foco. A configuração de domínio `showFrequencyVisually` distingue apenas a exibição visual e não autoriza anúncios automáticos.

## Controle compartilhado pelas modalidades

1. Manter um `input type="range"` nativo, com nome estável “Ajustar tom” e posição normalizada, sem armazenar Hz em seu valor acessível.
2. Fornecer instrução estática fora de região viva: “Use as setas para ajustar pelo som. Você também pode usar os botões Diminuir tom e Aumentar tom.”
3. Usar `aria-valuetext` constante e significativo: “Ajuste pelo som”. Não usar texto vazio, espaços, Hz ou rótulos que variem com a altura.
4. Preservar informações de faixa e valor exigidas pela semântica. Não remover `aria-valuenow` de um controle customizado nem esconder o controle inteiro para silenciá-lo.
5. Disponibilizar botões de nome estável “Diminuir tom” e “Aumentar tom”, operáveis por teclado e gestos de leitores de tela. Eles modificam o mesmo valor e não movem o foco nem alteram seus nomes.
6. Usar a via por botões como alternativa prática quando uma combinação de navegador/leitor insistir em narrar cada valor do slider. Não presumir que `aria-live="off"` suprime anúncios de valor feitos pelo próprio leitor.

O ajuste é monotônico na escala logarítmica. Setas e botões mudam a posição normalizada em 0,001; Page Up/Page Down mudam em 0,01; Home/End usam os extremos. O range usa `step="any"` para preservar a posição inicial sorteada sem quantizá-la. A confirmação é um controle separado.

Alguns leitores anunciam o valor nativo apesar de `aria-valuetext`; outros podem repetir o texto constante. A normalização impede que o valor nativo seja diretamente Hz, mas não garante silêncio. Os botões evitam depender de mudanças de valor de um slider focado para toda a interação.

Não usar `role="application"`, valores ARIA falsos, supressão global de teclado ou remoção da semântica como atalhos. Se os testes reais indicarem que a combinação proposta é insuficiente, registrar o problema e revisar a implementação mantendo as regras aprovadas.

## Exibição e consulta de números

- **Normal:** Hz pode ser exibido visualmente em um elemento comum, sem `aria-live`, sem papel `status` e sem associação dinâmica ao nome ou à descrição do slider. Não usar `output` com comportamento implícito de status para atualizações de frequência. O texto pode ser consultado intencionalmente, mas nunca recebe foco automático.
- **Hard/Extreme:** não apresentar Hz na tentativa, inclusive em descrições, tooltips e rótulos acessíveis.
- **Resultados:** usar texto semântico comum, por exemplo uma lista de descrição ou tabela, com alvo, resposta, diferença e pontuação. Nenhum desses números fará parte de uma mensagem viva.
- **Gráfico:** SVG com título e descrição estáveis, sem foco ou região viva. A escala visual permanece 0–10. A tabela adjacente apresenta os cinco rounds e suas notas, consultáveis sob demanda; ambos vêm da mesma lista de resultados. As alturas mantêm precisão; somente os textos usam duas casas.

Não colocar `aria-hidden` em botões ou no slider. Não publicar informações numéricas escondidas em nomes acessíveis para compensar a interface visual.

## Mensagens e foco

A implementação mantém a região viva vazia durante a preparação, contagem, referência e tentativa. Não move foco automaticamente durante os tons. O foco vai para Encerrar partida antes da contagem, para a ação de continuar após a cauda sonora e para um título sem números ao abrir o resultado final. A entrada inicial da página não força foco.

No Extreme, confirmações intermediárias mantêm o mesmo botão e foco, sem mensagens vivas, revelação de valores ou regiões de resultado. A posição do palpite na sequência permanece consultável em texto não vivo. “Resposta confirmada.” só é emitido após a última confirmação e a cauda sonora; “Partida concluída.” também ocorre sem tons. Dados numéricos de resultado não fazem parte de mensagens vivas ou nomes desses destinos de foco. O teste de áudio só anuncia sua conclusão após o término sonoro. Mensagens de erro são consultáveis em texto, com feedback vivo curto após a limpeza.

Uma região viva curta e controlada, inicialmente vazia, poderá informar somente etapas: “Prepare-se”, “Tentativa disponível”, “Resposta confirmada” ou “Partida interrompida”.

- Não anunciar cada segundo da contagem.
- Não anunciar o início de cada frequência do Extreme durante a sequência.
- Não iniciar nova mensagem enquanto um tom estiver ativo; encerrar a cauda sonora antes da mensagem de resultado.
- Não mover automaticamente o foco para o slider no instante em que começa o tom: leitores podem narrar o foco. Manter o controle alcançável pela sequência de teclado e validar o melhor posicionamento do foco na transição.
- Não mover o foco para o valor alvo ou nota. Em resultado, um título estável ou ação de continuar pode ser o destino, desde que não cause fala sobre a cauda de áudio.
- Conservar foco previsível ao remover uma tela e permitir alcançar rapidamente o ajuste e a confirmação.

Há tensão entre anunciar “Tentativa disponível” e iniciar automaticamente o tom. Nas modalidades implementadas, essa mensagem viva é omitida, usando disponibilidade semântica do controle e instrução antecipada. Os anúncios ocorrem depois do encerramento do som. **Não acrescentar uma etapa obrigatória de clique para começar a tentativa nem mudar a mecânica de início automático sem autorização.**

A Web Audio API não controla a fala de leitores de tela. Não chamar `speechSynthesis.cancel()` para tentar interromper NVDA, VoiceOver ou TalkBack. A implementação pode impedir seus próprios anúncios de números e minimizar mensagens, mas não garantir ausência absoluta de fala provocada por navegação intencional.

## Validação manual pelo usuário

Registrar sistema operacional, navegador, leitor e versões, método de entrada, modo do jogo, passos executados e fala observada.

| Combinação alvo                 | Entrada        | Situação nesta fase                                                                                   |
| ------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------- |
| Windows + NVDA + Chrome/Firefox | Teclado        | Relato positivo com NVDA no Normal; navegador/versões não informados; Hard/Extreme aguardam o usuário |
| macOS/iOS + VoiceOver + Safari  | Teclado/gestos | Pendente; não executado                                                                               |
| Android + TalkBack + Chrome     | Gestos         | Pendente; não executado                                                                               |

Casos para a versão jogável, incluindo a Fase 6:

Na entrega da Fase 4, o NVDA foi encontrado instalado, mas o controle Windows falhou antes de qualquer ação com `sandboxCwd is not a local file URI: file:///home/mat/www/memofreq`. Reiniciar a sessão da ferramenta e repetir a inicialização não resolveu. O agente não observou fala nessa sessão. Depois da entrega, o usuário testou manualmente e relatou funcionamento com NVDA. Esse relato não especificou todos os passos abaixo nem valida outros leitores ou modalidades. Os próximos casos serão executados pelo usuário diretamente na interface; não repetir tentativas de automação do leitor. DOM e axe continuam como verificações complementares.

1. Encontrar “Ajustar tom” e entender a instrução sem ouvir Hz.
2. Ajustar com setas e gestos; registrar qualquer anúncio nativo persistente.
3. Ajustar com botões alternativos mantendo o foco; verificar ausência de mensagens dinâmicas por movimento.
4. Confirmar sem anunciar automaticamente alvo, resposta ou nota.
5. Consultar todos os dados do resultado por navegação intencional.
6. Ouvir a referência completa sem mensagens da aplicação sobrepostas.
7. Verificar início automático da tentativa e ausência de anúncios programáticos nesse intervalo.
8. Repetir no Normal, Hard e Extreme com duas e três frequências.
9. Consultar a descrição do gráfico e a tabela final, sem anúncio automático de notas ou frequências.
10. Verificar a navegação com texto ampliado; testes automatizados cobrem 320 px e texto a 200%, sem substituir zoom e gestos reais.

Testes de DOM, axe e teclado automatizado verificam parte da estrutura; não validam o que o leitor efetivamente fala.

Referência: [W3C — Slider Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/), incluindo a necessidade de testar tecnologias assistivas em dispositivos de toque.
