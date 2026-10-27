# Layout compacto — 27/10/2026

## Entrega

Compactação das quatro telas para reduzir a rolagem, priorizando o gameplay mobile. A alteração reduz espaçamentos verticais, dimensões dos painéis e a área das ondas, preservando cores, fontes, imagens, composição e ordem dos elementos. Somente os três arquivos CSS de apresentação foram alterados no código da aplicação. Domínio, controlador, hook, engine, DOM, semântica e mecânicas permanecem inalterados. Nenhuma dependência foi adicionada.

A onda do gameplay adapta sua altura ao viewport com `clamp()` e `100svh`. Telas de até 800 px de largura e 740 px de altura recebem compactação adicional; a contagem reserva ao menos 104 px para o círculo. O conteúdo continua podendo crescer e rolar, inclusive com texto ampliado, sem cortes para forçar o encaixe.

## Aprovação manual

O usuário testou a alteração local e relatou “ficou tudo certo”, autorizando os testes e o commit. Dispositivo, navegador, versões e casos específicos não foram informados. Esse relato não certifica aparelhos físicos, escuta humana ou leitores de tela não discriminados.

## Verificações

- `npm run check`: aprovado, incluindo lint, formatação, 181 testes Vitest em dez arquivos, TypeScript e build estático.
- `npm run test:e2e -- --fully-parallel`: 60 casos aprovados em 8,7 minutos, sendo 15 em Chromium desktop, 15 em Pixel 7 emulado, 15 em Firefox e 15 em WebKit Linux. A suíte cobre os quatro perfis de modalidade, partidas completas, áudio nativo/offline, interrupções, foco, teclado, axe, reflow a 320 px com texto a 200%, movimento reduzido e build estático em subpasta.
- Formatação dos documentos atualizados e `git diff --check`: aprovados.
- Build: CSS 57,25 kB (gzip 12,80 kB), JavaScript 282,46 kB (gzip 86,41 kB) e fonte Inter local 352,24 kB.

## Ambiente E2E

Node 24.21.0 e npm 11.19.0. A primeira tentativa foi impedida pelas restrições de portas locais do sandbox. A tentativa fora do sandbox identificou navegadores ausentes; os 60 casos pararam antes de abrir a aplicação. Esses resultados de infraestrutura não foram tratados como validação do jogo.

Navegadores foram baixados em `/tmp/memofreq-playwright`; bibliotecas Ubuntu foram baixadas e extraídas em `/tmp/memofreq-browser-libs`, sem instalação no sistema. O wrapper temporário do WebKit foi ajustado para preservar `LD_LIBRARY_PATH`. A validação global de dependências foi desativada apenas nessa execução, após conferir bibliotecas com `ldd`, pois os arquivos extraídos não entram no cache global do linker.

Uma saída PulseAudio nula com socket privado em `/tmp/memofreq-pulse` permitiu os testes de áudio nativo. A suíte usa os tempos reais do produto, dois workers e distribuição `--fully-parallel`, sem alterar a configuração versionada. Servidores do build são encerrados pelo Playwright e o servidor de áudio temporário é encerrado após os testes. Nada desse ambiente temporário integra o commit.

Emulação móvel e WebKit Linux não equivalem a aparelhos Android ou Safari/iOS físicos. Testes de DOM, axe e áudio nativo/offline não substituem escuta humana nem certificam a fala de um leitor de tela. Os itens manuais não observados permanecem pendentes no checklist.

## Encerramento

Nenhuma correção adicional foi necessária após os testes. Commit local solicitado pelo usuário; push não realizado nesta entrega. Relatórios temporários, builds, navegadores e bibliotecas não são versionados.
