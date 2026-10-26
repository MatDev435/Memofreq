# Engine de áudio — Fase 3

## Limites

`WebAudioEngine` é independente do React e das regras do jogo. Implementa `AudioPort`, recebe uma faixa de frequências na construção e não sorteia alvos nem calcula resultados. A aplicação injeta `DEFAULT_RULES.range` e os tempos da modalidade.

As Fases 4 e 5 integram a engine à interface de Normal, Hard e Extreme. A engine permanece independente dessa apresentação e pode ser testada isoladamente.

## Contrato

| Operação                          | Comportamento                                                         |
| --------------------------------- | --------------------------------------------------------------------- |
| `enable()`                        | Cria ou retoma um contexto por gesto do usuário; não toca sons        |
| `playSample()`                    | Toca por 0,5 s o centro geométrico da faixa, independente dos alvos   |
| `playReference(tone)`             | Agenda uma referência com frequência e duração explícitas             |
| `playSequence(tones, gapSeconds)` | Agenda toda a sequência e os intervalos pelo relógio do áudio         |
| `startContinuous(frequencyHz)`    | Inicia uma voz senoidal sem término automático                        |
| `setFrequency(frequencyHz)`       | Atualiza a voz contínua com suavização, sem recriá-la                 |
| `setVolume(volume)`               | Define volume normalizado entre zero e um pelo ganho mestre           |
| `cancel()`                        | Cancela habilitação pendente e reprodução atual, aguardando a limpeza |
| `dispose()`                       | Cancela, remove listener, desconecta ganho mestre e fecha o contexto  |

Cada reprodução retorna um handle imutável com `id`, `startsAt`, `endsAt`, `finished`, `hasStarted()`, `stop()` e `cancel()`. Os tempos pertencem a `AudioContext.currentTime`; `endsAt` é nulo para tom contínuo e representa o término natural planejado de referências.

`finished` resolve com o identificador, sinal de início e um dos estados:

- `completed`: todas as referências terminaram naturalmente.
- `stopped`: parada explícita, por exemplo ao confirmar uma tentativa.
- `cancelled`: cancelamento, sem validar uma referência como concluída.
- `interrupted`: suspensão, fechamento do contexto ou falha durante execução/limpeza.

O sinal `started` registra se o relógio atingiu o início programado. Ele não afirma que o usuário ouviu um dispositivo físico. O valor fica preservado depois do encerramento: uma reprodução cancelada antes do início não passa a parecer iniciada quando o relógio avança posteriormente.

As promessas de término não rejeitam. Erros de parâmetros ou da API nativa são reportados pela chamada correspondente; erros de habilitação e descarte rejeitam suas promessas. Cancelamento durante a habilitação usa `AbortError`. O chamador precisa tratar essas falhas.

## Contexto, autoplay e concorrência

O construtor não cria AudioContext. `enable()` chama a fábrica e, se necessário, `resume()` antes de qualquer `await`, preservando a chamada dentro da interação do usuário. Habilitações concorrentes compartilham a mesma promessa. A espera é limitada a cinco segundos, permitindo uma nova tentativa explícita se o navegador não liberar o áudio.

A engine é proprietária do contexto retornado por `createContext` e o fecha no descarte. Uma fábrica injetada deve fornecer um contexto exclusivo, sem compartilhá-lo com outros consumidores.

Cancelar ou descartar invalida a promessa de habilitação pendente. Uma resolução tardia de `resume()` não inicia reprodução nem conclui uma solicitação nova. O contexto pode ser reutilizado após cancelamento; depois de `dispose()` ou fechamento definitivo, é necessário criar outra engine.

Uma única reprodução pode ocupar a engine por vez, incluindo o fade de saída. Uma tentativa de sobreposição lança erro. O controlador deve aguardar a promessa de término/parada antes de começar outra voz ou sequência. Isso evita osciladores duplicados ou substituições que cortem o som abruptamente.

Identificadores de reprodução aumentam durante a vida da engine. Parar ou receber um callback de um handle antigo não altera a reprodução atual. Esses IDs são distintos de `gameId`/`executionId` do domínio; o controlador fará a associação entre eles.

## Grafo e agendamento

O grafo é `OscillatorNode → GainNode da voz → GainNode mestre → destination`. Todas as vozes usam onda `sine` e o mesmo ganho de sustentação. O volume inicial é 0,4 em uma escala normalizada, multiplicado por um teto técnico de ganho 0,2: ganho inicial efetivo de aproximadamente 0,08.

As constantes técnicas ficam em `src/audio/config.ts`. Os limites 50–700 Hz permanecem exclusivamente na configuração do domínio e são injetados na composição.

- Margem inicial de agendamento: 10 ms por operação, sem alterar a duração dos tons ou intervalos entre eles.
- Entrada e saída: 15 ms, dentro da duração da referência. Tons muito curtos recebem envelopes de no máximo metade de sua duração.
- Mudança de frequência e volume: rampas de 15 ms.
- Durações e posições temporais são validadas antes de criar vozes. Valores que não podem ser representados no relógio são rejeitados.
- Inícios, términos e intervalos usam o relógio da Web Audio API. Não há timer JavaScript para encerrar referências ou iniciar cada item da sequência.
- `ended` desconecta cada fonte; a promessa é concluída depois da limpeza de todas as vozes. Atrasos do event loop podem atrasar a disponibilidade lógica da próxima etapa, mas não alongam o tom agendado.

O ajuste contínuo usa o mesmo oscilador. A automação anterior é substituída por `cancelAndHoldAtTime` quando disponível. O fallback calcula o valor linear corrente, cancela os eventos futuros e fixa esse valor antes da próxima rampa. A leitura isolada de `AudioParam.value` não é usada como substituto da interpolação controlada.

## Cancelamento e interrupções

`stop()` encerra suavemente a voz ativa. `cancel()` faz o mesmo e remove imediatamente as vozes cujo início ainda não ocorreu. A parada de fontes futuras acontece antes do horário de início, com desconexão e remoção de callbacks, garantindo que não apareçam depois.

Cancelamentos repetidos não reprogramam o fade nem duplicam encerramentos. Cancelar durante uma parada promove o resultado a `cancelled`. Uma sequência cancelada nunca resolve como `completed`.

O listener de `statechange` trata suspensão, estado `interrupted` e fechamento. Ele desconecta imediatamente todas as vozes, pois um relógio suspenso não terminaria um fade. A retomada explícita habilita somente o contexto, sem ressuscitar nós antigos.

`onInterruption` recebe o ID da reprodução, motivo e sinal de início. Sem reprodução ativa, o ID é nulo; isso permite ao futuro controlador tratar uma contagem cuja engine foi suspensa. A callback ocorre após a limpeza e não decide se uma partida é válida.

A engine não observa visibilidade da página. O domínio já decide o que preservar ou interromper por estado; o controlador futuro aplicará o cancelamento correspondente. Resultados não serão invalidados globalmente por troca de aba.

`dispose()` é irreversível e compartilha a promessa entre chamadas concorrentes. Mantém o listener enquanto aguarda a cauda, trata uma suspensão nesse intervalo e remove o listener antes de fechar. A limpeza do contexto fica em `finally`, inclusive se uma operação nativa de parada falhar.

## Verificação automatizada

- Um contexto controlado verifica agendamento, número de nós, automação, fallback, cancelamento, descarte e eventos atrasados sem depender de tempo real.
- Os testes Playwright usam um bundle em memória da engine, sem incluí-lo antecipadamente na aplicação estática.
- AudioContext nativo verifica habilitação por clique, sequência, ajuste contínuo, parada, suspensão e descarte.
- OfflineAudioContext usa nós e DSP nativos para verificar amostras de senoides de 200/400 Hz, ganho consistente, silêncio nas pausas, limites de amplitude e continuidade entre amostras. Somente o estado de controle é adaptado para o contexto offline, que não implementa o ciclo de autoplay/fechamento de um contexto em tempo real.
- Cancelar antes do início produz amostras silenciosas em toda a renderização offline.

Essas verificações não equivalem a escuta humana, teste de fones, validação de latência de hardware, Safari/Firefox ou leitores de tela reais.

## Roteiro de escuta manual

Na interface jogável, abra a URL impressa por `npm run dev` e use **Testar áudio** e **Volume**. Inicie uma partida Normal, ouça a referência e ajuste o tom contínuo pelo slider ou pelos botões. Confirme para verificar o fade e avance pelos cinco rounds. Encerrar partida deve silenciar o áudio; resultados devem permitir consulta sem replay.

No Hard, verifique a referência de 1,5 s e a frequência oculta. No Extreme, ouça toda a sequência com pausas de 300 ms e responda na ordem: a confirmação intermediária sorteia outra posição na mesma voz contínua, sem resultado ou nova referência. Os dados de todas as respostas e a média só aparecem após a última confirmação.

O usuário relatou funcionamento da versão Normal, inclusive com NVDA, em 26/10/2026 e assumiu as próximas verificações manuais. Isso não comprova avaliação individual de todos os casos abaixo.

Registre qualidade sonora, estalos, continuidade do ajuste e comportamento com fones no checklist manual somente após ouvir de fato. Os testes automatizados de PCM e API não substituem essa escuta.

### Diagnóstico isolado para desenvolvimento

Inicie `npm run dev`. No console do navegador, prepare uma verificação isolada:

```js
const { WebAudioEngine } = await import('/src/audio/WebAudioEngine.ts');
const { DEFAULT_RULES } = await import('/src/domain/config.ts');
const audio = new WebAudioEngine({ range: DEFAULT_RULES.range });
const button = document.createElement('button');
button.textContent = 'Testar áudio';
button.onclick = () => {
  void audio
    .enable()
    .then(() => audio.playSample().finished)
    .catch(console.error);
};
document.body.append(button);
```

Use fones e volume confortável, pressione o botão e avalie o som de exemplo. Para testar o tom contínuo, substitua temporariamente a ação:

```js
let tone;
button.onclick = () => {
  void audio
    .enable()
    .then(() => {
      tone = audio.startContinuous(200);
    })
    .catch(console.error);
};
```

Após pressioná-lo, experimente `audio.setFrequency(300)`, `audio.setFrequency(500)` e `audio.setVolume(0.2)` pelo console. Encerre com `await tone.stop()`. Verifique continuidade e fade; esse diagnóstico direto da engine é separado do teste do slider da aplicação.

Finalize a bancada temporária com `await audio.dispose(); button.remove();`. Registre os resultados no checklist manual somente após ouvir de fato. Esses controles temporários de inspeção não pertencem à interface do produto.

## Referências

- [MDN — AudioContext.resume](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume).
- [MDN — estados do contexto](https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state).
- [MDN — cancelAndHoldAtTime](https://developer.mozilla.org/en-US/docs/Web/API/AudioParam/cancelAndHoldAtTime).
- [MDN — parada de uma fonte agendada](https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/stop).
