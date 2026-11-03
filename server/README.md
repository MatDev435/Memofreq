# Backend multiplayer

Servidor autoritativo das salas multiplayer, em Cloudflare Workers com Durable Objects. Cada sala é um Durable Object que serializa os eventos, gera os alvos, valida os palpites e calcula as pontuações com as funções puras de `src/domain`. O frontend continua uma SPA estática na Vercel. O protocolo está em [`docs/multiplayer-protocol.md`](../docs/multiplayer-protocol.md).

## Estrutura

```text
server/
  wrangler.jsonc          Configuração pública: binding ROOMS, migração SQLite, origens
  .env.example            Variáveis do Wrangler para deploy sem login (sem valores)
  src/
    index.ts              Worker: /health, criação/entrada, Origin, encaminhamento
    RoomObject.ts         Durable Object: WebSocket com hibernação, storage, alarm
    protocol.ts           Tipos e validação das mensagens (compartilhável com o frontend)
    codes.ts              Códigos de sala, IDs e sorteio com crypto
    origin.ts, reject.ts  Origens permitidas e recusa de entrada
    env.ts                Bindings e cabeçalhos internos
    room/
      model.ts            Estado serializável da sala
      room.ts             Máquina de estados pura (sem rede, tempo ou storage)
      view.ts             Estado público e ranking
      names.ts            Normalização dos apelidos
      testing.ts          Utilitários dos testes unitários
  integration/            Testes do protocolo contra o wrangler dev
```

O código compartilhado não é duplicado. `room.ts` importa de `src/domain` a geração das referências e das posições iniciais, a validação da faixa, `evaluateAttempt`, `meanScore` e `totalScore`. O Wrangler empacota esses arquivos no Worker. O single-player não foi alterado.

## Armazenamento

A sala usa a API de hibernação: entre mensagens, a memória pode ser descartada sem fechar os WebSockets. Por isso o estado completo da sala fica em uma única chave do storage SQLite do Durable Object, regravada a cada mudança e lida ao acordar. Cada conexão guarda só o ID do participante e o último sinal no próprio WebSocket.

Quando o último participante sai, a sala apaga o storage e o alarm, e o código deixa de funcionar. Não há histórico, banco externo nem recuperação de partidas. Se um reinício derrubar as conexões, os participantes sem WebSocket são removidos ao acordar e, sem ninguém, a sala é apagada.

## Executar localmente

Requer Node 24 e as dependências instaladas com `npm ci`. Não precisa de conta Cloudflare.

```sh
npm run server:dev
```

O Worker sobe em `http://127.0.0.1:8787` com Durable Objects simulados pelo `workerd`. O estado local fica em `server/.wrangler/`, ignorado pelo Git. Para testar à mão, conecte um cliente WebSocket com um `Origin` permitido. Exemplo no Node 24:

```sh
node -e "const ws=new WebSocket('ws://127.0.0.1:8787/rooms?name=Ana',{headers:{Origin:'http://localhost:5173'}});ws.onmessage=e=>console.log(String(e.data))"
```

Para outras origens locais, edite `ALLOWED_ORIGINS` em `wrangler.jsonc` ou crie `server/.dev.vars` (ignorado) com `ALLOWED_ORIGINS=...`.

## Usar com o frontend local

Copie `.env.example` (raiz) para `.env.local`, mantendo `VITE_MULTIPLAYER_URL=ws://127.0.0.1:8787`, e rode `npm run server:dev` e `npm run dev`. As origens `http://127.0.0.1:5173` e `http://localhost:5173` já são permitidas. A suíte E2E sobe sua própria instância na porta 8797 e um build de preview que aponta para ela.

## Testes

```sh
npm run test:run     # unitários do projeto, incluindo server/src
npm run test:server  # integração: sobe wrangler dev na porta 8798 e usa WebSockets reais
npm run check        # lint, formatação, unitários, tipos e build
```

A integração usa storage temporário e encurta a verificação de inatividade (`SWEEP_INTERVAL_MS` 500 ms, `INACTIVE_AFTER_MS` 1500 ms). Se a porta estiver ocupada, use `MEMOFREQ_SERVER_TEST_PORT=<porta>`.

## Publicar gratuitamente na Cloudflare

1. Crie uma conta Cloudflare. O plano Workers Free inclui Durable Objects com storage SQLite.
2. Autentique:
   - **Interativo (recomendado):** `npx wrangler login`. Nenhuma credencial fica no repositório.
   - **Por variáveis:** copie `server/.env.example` para `server/.env` e preencha `CLOUDFLARE_API_TOKEN` (modelo "Edit Cloudflare Workers") e `CLOUDFLARE_ACCOUNT_ID`. `server/.env` é ignorado pelo Git; nunca o envie.
3. Confira `ALLOWED_ORIGINS` em `wrangler.jsonc`. Ela já inclui `https://memofreq.vercel.app`. Previews da Vercel usam outros domínios e precisam ser acrescentados explicitamente.
4. Valide sem publicar: `npx wrangler deploy --dry-run --cwd server`.
5. Publique: `npm run server:deploy`. O Worker fica em `https://memofreq-multiplayer.<subdomínio>.workers.dev`. Confira em `/health`.
6. Configure no projeto da Vercel `VITE_MULTIPLAYER_URL=wss://memofreq-multiplayer.<subdomínio>.workers.dev` e gere um novo deploy do frontend; a variável é lida no build.

Limites do plano gratuito consultados em 03/11/2026: 100 mil requisições por dia, 13.000 GB-s de duração por dia, 5 GB de storage SQLite, contadores zerados às 00:00 UTC e operações recusadas ao exceder. Mensagens WebSocket recebidas contam na proporção 20:1, e o ping respondido automaticamente não acorda a sala. A documentação de alarms não informa restrição de plano; confirme no primeiro deploy.

## Limitações conhecidas

- O alvo do round vigente precisa chegar ao navegador para ser sintetizado e pode ser lido por inspeção. Rounds futuros e palpites alheios não são enviados antes da hora.
- `Origin` filtra navegadores em outros sites, mas não autentica: clientes fora do navegador podem forjá-lo.
- Os limites de abuso são locais à sala (oito participantes, 2048 caracteres e 30 mensagens por 10 s por conexão). Não há limite global por IP para criar salas.
- Quedas silenciosas levam de 75 a 105 s para ser detectadas. Enquanto isso, a sala espera, e o host pode remover o participante.
- O fechamento iniciado pelo servidor em outra conexão chegou cerca de 10 s depois no `workerd` local. A mensagem fatal e a remoção são imediatas. Comportamento em produção não verificado.
- Apelidos com caracteres invisíveis são recusados, inclusive emojis compostos com zero-width joiner.
