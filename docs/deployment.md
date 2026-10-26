# Build e hospedagem estática

Memofreq gera uma SPA estática. O build contém HTML, JavaScript e CSS; o domínio e a engine de áudio executam no navegador. Não há servidor de aplicação, API, contas ou persistência para implantar.

## Preparar o artefato

Use Node 24 e npm 11, conforme `.nvmrc` e `package.json`:

```sh
npm ci
npm run check
```

O artefato fica em `dist/`. Copie seu conteúdo para a raiz ou subpasta do host estático escolhido. Preserve a estrutura de `assets/`, sirva `.js` como JavaScript e `.css` como CSS e use HTTPS em um host remoto. Abra a pasta pela URL HTTP/HTTPS terminada em `/`.

`base: './'` mantém os assets relativos à página. A aplicação atual não tem rotas de caminho: a inicial, a partida e os resultados são estados da mesma página. Recarregar retorna à inicial e perde o progresso, conforme a especificação. Não é necessário um fallback genérico para servir a página atual; assets inexistentes devem responder 404.

## Validação local do build

```sh
npm run preview
```

Para verificar o mesmo artefato em subpasta, sem Vite:

```sh
node e2e/static-server.ts
```

Esse servidor é um fixture de teste local, ligado a `127.0.0.1:4174`. Abra `http://127.0.0.1:4174/memofreq/`. Ele entrega somente arquivos de `dist/`, com tipos de conteúdo explícitos e sem transformação ou fallback. Encerre com Ctrl+C antes de rodar a suíte, pois o Playwright gerencia sua própria instância.

A suíte automatizada verifica carregamento dos assets na subpasta, início do áudio por interação, um round Hard, recarga da página e resposta 404 para um asset ausente. Esses casos usam Chromium desktop, celular emulado, Firefox e WebKit Linux.

## Navegadores e áudio em testes sem dispositivo

```sh
npx playwright install chromium firefox webkit
npm run test:e2e
```

No Linux, `npx playwright install --with-deps chromium firefox webkit` também instala bibliotecas de sistema e pode exigir privilégios administrativos. Firefox e WebKit precisam conseguir abrir uma saída de áudio, mesmo que virtual. Em uma máquina sem dispositivo, use um servidor de áudio de teste com saída nula, mantendo o relógio nativo em tempo real. A CI usa PulseAudio para isso.

A preparação temporária específica deste ambiente Linux, sem instalação de pacotes no sistema, está registrada no [relatório da Fase 6](phase-6-report.md). Ela não é uma dependência do produto nem altera os comandos de hospedagem.

## Estado da publicação

A Fase 6 valida tecnicamente o artefato estático e sua execução local em uma subpasta. Nenhum provedor, domínio, credencial de hospedagem ou publicação remota foi configurado. O repositório GitHub permanece privado; o envio de código e a execução da CI não publicam o jogo.

Uma publicação futura deverá registrar host, URL, HTTPS e verificação do build servido. O acabamento visual definitivo continua uma etapa própria.
