# Especificação funcional do Memofreq

Status: aprovada para implementação incremental, com ajustes aprovados em 26/10/2026. Este documento é a fonte de verdade das mecânicas. As Fases 4 e 5 integram domínio, engine e interface para Normal, Hard e Extreme com duas ou três referências. O gráfico aguarda autorização da Fase 6; a identidade visual definitiva será refinada posteriormente.

## 1. Produto e escopo

Memofreq é um jogo web SPA de memória e percepção auditiva. O jogador ouve referências uma única vez e tenta reproduzi-las ajustando a frequência de um tom contínuo.

A primeira versão é exclusivamente frontend: React, TypeScript estrito, Vite, HTML semântico, CSS moderno e Web Audio API nativa. Sem backend, contas, banco de dados ou persistência remota.

A inspiração conceitual é o Dialed Sound, sem copiar design ou código. A interface inicial será mínima, organizada, responsiva e acessível.

## 2. Regras compartilhadas

- Exatamente cinco rounds por partida.
- Cada round vale de zero a dez pontos; total de zero a cinquenta.
- Contagem regressiva de três segundos antes das referências de cada round.
- Faixa de frequências: 50 a 700 Hz, centralizada em configuração.
- Sorteios e movimento do slider em escala logarítmica, com precisão decimal.
- Referências nunca podem ser reproduzidas novamente após a apresentação inicial.
- Ao terminar as referências, começa automaticamente o tom contínuo da tentativa, desde que o áudio habilitado esteja funcionando.
- O jogador ajusta o slider e confirma uma única resposta definitiva.
- Confirmar encerra suavemente o tom e revela o resultado.
- Não é possível editar respostas confirmadas, retornar a tentativas ou avançar sem concluí-las.
- Não há limite de tempo da tentativa definido nesta versão.

## 3. Modalidades

| Configuração               | Normal               | Hard                 | Extreme                         |
| -------------------------- | -------------------- | -------------------- | ------------------------------- |
| Rounds                     | 5                    | 5                    | 5                               |
| Referências por round      | 1                    | 1                    | 2 ou 3                          |
| Duração de cada referência | 3 s                  | 1,5 s                | 1,5 s                           |
| Pausa entre referências    | Não se aplica        | Não se aplica        | 300 ms                          |
| Hz visível na tentativa    | Sim                  | Não                  | Não                             |
| Tom da tentativa           | Contínuo             | Contínuo             | Contínuo                        |
| Replay                     | Proibido             | Proibido             | Proibido                        |
| Pontuação do round         | Tentativa individual | Tentativa individual | Média aritmética das tentativas |

No Extreme, a escolha de duas ou três referências é feita antes de iniciar e permanece por toda a partida. As frequências de cada sequência são distintas e sua ordem é imprevisível. Não há separação perceptual mínima adicional aprovada entre referências.

A pausa de 300 ms ocorre somente entre sons, sem pausa adicional antes do primeiro ou depois do último. A sequência inteira é apresentada antes da primeira tentativa.

O jogador responde na ordem original. Após confirmar a primeira tentativa, consulta o resultado e avança à seguinte, que recebe uma nova posição inicial aleatória. Após a última, consulta também a média do round. Não há reprodução automática ou por botão dos alvos na tela de resultados.

## 4. Geração e posição inicial

As referências usam uma distribuição uniforme no logaritmo da frequência. Para posição normalizada `u` entre zero e um, a frequência corresponde a `min × (max/min)^u`.

Isso evita restringir a mecânica a frequências inteiras e distribui o sorteio por intervalos proporcionais. A aleatoriedade é substituível por uma fonte controlada em testes.

Toda tentativa começa em uma frequência aleatória da faixa, cuja distância ao alvo é de pelo menos 300 cents. A distância considera a razão entre frequências:

`distanceCents = 1200 × abs(log2(initialFrequency / targetFrequency))`

O sorteio será feito diretamente nos intervalos permitidos da escala logarítmica, sem laço de rejeição ilimitado. O valor 300 é configurável, mas uma configuração sem posições válidas deve ser rejeitada antes da partida; a regra nunca será relaxada silenciosamente.

## 5. Áudio

- Onda senoidal pura, ganho consistente e volume confortável.
- `AudioContext` reutilizável; habilitação ou retomada por interação inicial do usuário.
- Oscilador contínuo único por tentativa, sem reinício a cada movimento do slider.
- Mudanças de frequência suavizadas em aproximadamente 10–20 ms.
- Envelopes curtos de entrada e saída para evitar cliques.
- Duração das referências e intervalos agendados no relógio da Web Audio API.
- Parada de todos os nós ativos ou agendados ao cancelar uma execução.
- Nenhum áudio de partida pode permanecer após sair ou reiniciar.
- Um contexto suspenso ou uma falha não pode produzir uma tentativa aparentemente válida sem a referência correta.

## 6. Pontuação e arredondamento

`distanceCents = 1200 × abs(log2(playerFrequency / targetFrequency))`

`score = 10 × max(0, 1 − distanceCents / 500)`

- Acerto exato vale dez.
- Distância de 500 cents ou mais vale zero.
- Pontuação limitada ao intervalo de zero a dez.
- A constante 500 é configurável.
- A função é pura; parâmetros inválidos não geram pontuação válida.
- Frequências devem ser positivas, finitas e válidas para a partida.

No Extreme, a pontuação de cada round é a média das duas ou três pontuações individuais. O total é a soma das pontuações dos cinco rounds.

Todos os cálculos preservam precisão interna. **Não arredondar antes de médias ou somas.** Apenas a apresentação utiliza duas casas decimais com formatação pt-BR, inclusive frequências e diferença absoluta em Hz. A soma de parcelas exibidas pode diferir do total exibido em um centésimo.

## 7. Resultados

Após cada tentativa, apresentar:

- Frequência alvo.
- Frequência escolhida.
- Diferença absoluta em Hz.
- Pontuação individual de zero a dez.
- No Extreme, posição respondida, por exemplo “Frequência 2 de 3”.

Depois de concluir o Extreme, apresentar também a média do round. Valores revelados não permitem edição nem replay.

Após cinco rounds, apresentar:

- Modalidade utilizada.
- Número de frequências por round no Extreme.
- Total de zero a cinquenta.
- Pontuação dos cinco rounds.
- Gráfico de barras com eixo de zero a dez.
- Dados equivalentes em texto acessível.
- Ações de jogar novamente e retornar à tela inicial.

Jogar novamente inicia uma nova partida com novos sorteios; não reabre respostas da anterior.

## 8. Tela inicial

Deve permitir entender o objetivo, selecionar Normal/Hard/Extreme, escolher duas ou três referências no Extreme, testar áudio e iniciar a partida.

O teste de áudio usa um exemplo independente dos alvos, volume conservador e duração definida; nunca pode revelar uma referência futura. Deve terminar antes de iniciar a partida.

Exibir recomendação de fones e ambiente silencioso e orientar ajuste de volume confortável. Não detectar, exigir ou bloquear dispositivos de áudio. Fones são recomendados, não obrigatórios.

## 9. Acessibilidade e política de fala

Requisito aprovado em todos os modos, inclusive Normal:

- Navegação completa por teclado, leitores de tela, foco visível e HTML semântico.
- Nome acessível estável do controle: “Ajustar tom”.
- Nenhum anúncio automático de valores em Hz, inclusive ao revelar resultados.
- Nenhum anúncio contínuo de alterações ou regiões de altura durante a movimentação.
- No Normal, Hz pode aparecer visualmente em texto não vivo.
- No Hard e Extreme, Hz permanece oculto durante a tentativa.
- Frequências dos resultados são texto acessível para consulta sob demanda, fora de regiões vivas.
- Anúncios de etapa são curtos e não são disparados sobre tons em reprodução.
- O foco não será movido automaticamente para um valor numérico revelado.
- Informar round, tentativa e disponibilidade da resposta sem narrar continuamente o slider.

Manter semântica de slider e oferecer uma via alternativa de ajuste por botões de nome estável, conforme a proposta em `accessibility.md`. A compatibilidade com leitores de tela reais deve ser documentada e testada nas fases jogáveis. O usuário relatou sucesso com NVDA no Normal e assumiu os próximos testes manuais em 26/10/2026; não se promete silêncio absoluto com base apenas em ARIA.

## 10. Interrupções

Trocar de aba não é motivo universal para invalidar uma partida.

- Tela inicial: interromper eventual teste de áudio; não há partida a invalidar.
- Preparação do áudio: cancelar a preparação pendente, preservando a seleção do modo.
- Contagem regressiva: cancelar a contagem e qualquer início futuro; manter a partida aguardando uma ação explícita para recomeçar os três segundos, desde que nenhuma referência tenha começado.
- Referências: ocultação da página ou interrupção efetiva do áudio invalida a partida, pois não se pode assegurar apresentação íntegra nem permitir replay.
- Tentativa: ocultação ou interrupção efetiva do áudio interrompe a partida, pois a integridade do tom contínuo e da tentativa foi comprometida.
- Resultados da tentativa, do round e final: preservar respostas e progresso. A troca de aba não invalida a partida. Não avançar ou iniciar áudio automaticamente ao voltar.
- Aguardar retomada da contagem: continuar aguardando; não tocar sons em segundo plano.
- Partida já interrompida: manter o estado, sem áudio.

A mudança de foco da janela, isoladamente, não implica interrupção. Na disputa entre contagem e primeiro som, qualquer evidência de início da referência exige tratar a interrupção como ocorrida nas referências.

A retomada a partir de resultado pode exigir clique para habilitar o contexto antes da próxima tentativa ou contagem. Nenhuma referência anterior será repetida. Detalhes de eventos e corridas estão na arquitetura.

## 11. Futuro, fora da implementação atual

Preparar modelos para distinguir Normal, Hard, Extreme com duas e Extreme com três frequências. Manter definição de desafios separada da pontuação.

Backend, contas, histórico remoto, rankings e desafio diário só serão implementados sob solicitação. Desafios competitivos exigirão geração e validação confiáveis no servidor; a aplicação frontend não oferece proteção contra inspeção dos dados ou manipulação dos resultados.
