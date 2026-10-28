# Timbre aditivo — 28/10/2026

## Escopo autorizado

Substituir o som anterior pelo preset fornecido e elevar a frequência base mínima de 50 para 80 Hz, mantendo o máximo em 700 Hz. Preservar interface, controles, escala logarítmica, sorteios, cinco rounds, pontuação, durações de referência, intervalos e fluxo do Extreme. O usuário autorizou testes, commit e push na branch atual após aprovação dos testes.

## Implementação

`src/audio/config.ts` concentra o preset: oito componentes declarados, cinco ativos, passa-baixas de 1000 Hz/Q 0,1, saturação tanh com k 1,63, passa-baixas de 9000 Hz, compressor com os parâmetros solicitados, normalização de 0,72 e envelopes lineares de 25/170 ms. O Q do filtro pós-saturação, não especificado no pedido, é definido como `1/sqrt(2)` na propriedade nativa. A curva tem 4097 pontos pré-calculados, sem DSP por amostra em JavaScript.

Cada voz lógica reúne osciladores senoidais de 0,5×, 2×, 3×, 4× e 5× da base. Ganhos de 1×, 1,5× e 6× são zero e não alocam osciladores. Todos os parciais compartilham início, fim e prazo de afinação; mudanças rápidas preservam os valores interpolados em cada componente. A mesma voz permanece entre palpites do Extreme.

Filtros, saturação e compressor pertencem à voz. O envelope é aplicado depois do DSP para silenciar as caudas nas pausas e ao parar. Todos os nós são registrados antes de sua configuração, inclusive para limpar falhas de construção parcial; a reprodução só termina após todos os parciais encerrarem. Fontes futuras, cancelamento idempotente e proteção contra callbacks antigos são preservados.

A saída usa ganho mestre `0.15 × volume`. O controle existente continua entre zero e um, inicialmente em 0,4 (ganho mestre inicial de 0,06). Assim, os 15% do preset não eliminam nem alteram o controle do jogador. Referência, tentativa e teste de áudio passam pela mesma engine e pelo mesmo timbre.

A configuração central do domínio passa à faixa base 80–700 Hz, versão 2 das regras. O parcial inferior pode soar em 40 Hz quando a base é 80 Hz; isso não muda os limites da frequência base usada pelo jogo. Não há mudanças em React, CSS, controlador, hook ou contrato `AudioPort`, nem dependências adicionadas.

## Validação e limites

Os testes unitários verificam ganhos, curva de saturação, filtros, compressor, envelope, afinação proporcional de todos os parciais, rampas, ausência de recriação, Nyquist, cancelamento e limpeza de falhas parciais. As expectativas de domínio foram atualizadas para a nova faixa, preservando testes de configurações arbitrárias.

Os testes de navegador verificam a afinação dos cinco osciladores nativos e renderizam o DSP com OfflineAudioContext em 44,1 e 48 kHz nas bases 80/200/400/700 Hz. Verificam componentes espectrais, ataque/release, silêncio nos intervalos e no cancelamento, amplitude e continuidade entre amostras. A instrumentação de partidas continua acompanhando vozes lógicas e também verifica o descarte das fontes.

Navegadores e bibliotecas Linux são preparados em `/tmp`, sem instalação de pacotes no sistema. Uma saída PulseAudio nula isolada permite testes de AudioContext nativo; os tempos do produto não são abreviados. O wrapper temporário do WebKit preserva as bibliotecas extraídas; a validação global do linker é omitida somente nesse ambiente temporário. Nenhum desses arquivos é versionado.

Não houve escuta humana, teste em dispositivo móvel físico ou operação de leitores de tela pelo agente. Emulação Pixel 7 não certifica aparelhos Android e WebKit Linux não certifica Safari/iOS. O roteiro de escuta do novo timbre permanece pendente com o usuário em `manual-testing.md`.

## Verificações executadas

- `npm run check`: lint, formatação, 192 testes Vitest em dez arquivos, TypeScript e build estático aprovados.
- Testes isolados de áudio nos quatro perfis: oito casos aprovados antes da suíte completa.
- `npm run test:e2e -- --fully-parallel`: 60 casos aprovados em 9,0 minutos, sendo 15 por perfil (Chromium desktop, Pixel 7 emulado, Firefox e WebKit Linux). Inclui partidas completas de Normal/Hard/Extreme com duas e três referências, afinação nativa dos cinco parciais, DSP offline nas duas taxas de amostragem, interrupções, descarte, foco, axe, reflow e build estático em subpasta.
- `git diff --check`: sem erros.

## Conclusão

Implementação e verificações concluídas na branch `main`, com commit e push autorizados. A avaliação sonora humana do novo preset permanece pendente; nenhuma aprovação anterior de áudio foi reaproveitada como validação deste timbre.
