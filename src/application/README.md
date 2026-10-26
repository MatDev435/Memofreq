# Aplicação — coordenação das modalidades

`audioPort.ts` define o contrato de reprodução, handles, resultados e interrupções implementado pela engine da Fase 3. Não depende de React, DOM ou regras do jogo.

`GameController.ts` coordena Normal, Hard e Extreme com duas ou três referências: habilitar áudio no gesto, aguardar a cauda de um teste, contar três segundos, apresentar uma referência ou sequência inteira, iniciar o tom contínuo, confirmar e avançar. Pontuação, validação e transições continuam no domínio; a engine permanece responsável pelos nós sonoros.

O controlador fornece um snapshot imutável e assinatura para `useSyncExternalStore`. O adaptador `useGameController.ts` conecta visibilidade e pagehide, e administra ativação/desativação do controlador. A composição concreta fica em `src/app/createGameController.ts`, com WebAudioEngine, aleatoriedade do navegador e identificadores externos ao reducer.

## Concorrência e limpeza

- Contextos de domínio são capturados antes de aguardar operações. Conclusões antigas não iniciam áudio nem mudam uma partida nova.
- IDs da reprodução identificam a voz correspondente; uma versão da instância também impede notificações de engines substituídas.
- O clique de confirmação registra a resposta imediatamente e bloqueia ajustes. Resultados e foco só são disponibilizados depois da cauda sonora. Uma troca de aba posterior preserva a resposta já confirmada.
- No Normal e Hard, o resultado da tentativa é consolidado como resultado do round sem exigir duas telas equivalentes. A próxima referência exige ação explícita.
- Contagem usa prazo monotônico e timer cancelável; durações dos tons continuam exclusivamente no relógio da engine. Retorno de visibilidade não reinicia som automaticamente.
- No Extreme, o resultado individual oferece avanço para a próxima tentativa, com novo sorteio inicial, habilitação por gesto e sem contagem ou replay. Após a última resposta, o domínio consolida a média do round.
- `start(selection)` recebe a modalidade; `restart()` preserva a seleção da sessão encerrada e cria outro desafio. A escolha não pode mudar durante a partida.
- Um contexto fechado pode ser substituído antes de uma próxima tentativa ou round; dados confirmados são preservados.
- Desativação invalida operações e cancela timers/vozes imediatamente. O descarte definitivo é agendado para a próxima microtask e só ocorre se não houver reconexão do mesmo controlador, permitindo o ciclo de montagem do StrictMode sem reutilizar uma engine descartada.

A política de foco e os anúncios ficam na apresentação. Durante referência e tentativa não há foco automático ou mensagens vivas da aplicação. A frequência visual é omitida no Hard e Extreme. Os próximos testes manuais com leitores de tela ficam com o usuário, conforme sua orientação.
