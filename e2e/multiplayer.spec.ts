import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectReflow } from './results-checks';
import {
  answerRound,
  capture,
  confirmAttempt,
  createRoom,
  expectAccessible,
  joinByCode,
  joinByInvite,
  liveRegion,
  openPlayer,
  participants,
  setVisible,
  trackErrors,
  waitForAttempt,
} from './multiplayer-helpers';

async function readyEveryone(pages: readonly Page[], name: RegExp | string) {
  for (const page of pages) await page.getByRole('button', { name }).click();
}

test('dois navegadores jogam cinco rounds no Normal, veem o ranking e jogam novamente', async ({
  page: host,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const errors = trackErrors(host);
  await host.goto('/');
  await capture(host, testInfo, 'mp-01-home');
  const link = await createRoom(host, 'Ana');
  expect(link).toMatch(/#sala=[0-9A-HJKMNP-TV-Z]{10}$/);

  const guest = await openPlayer(browser, testInfo);
  errors.push(...trackErrors(guest));
  await joinByInvite(guest, link, 'Bia');
  await expect(participants(host).getByRole('listitem')).toHaveCount(2);
  await expect(liveRegion(host)).toHaveText('Bia entrou na sala.');

  // Apelido repetido é recusado e o formulário continua disponível.
  const intruder = await openPlayer(browser, testInfo);
  await intruder.goto(link);
  await intruder.getByLabel('Seu apelido').fill('ana');
  await intruder.getByRole('button', { name: 'Entrar na sala' }).click();
  await expect(intruder.getByRole('alert')).toContainText(
    'apelido já está em uso',
  );
  await expect(intruder.getByLabel('Seu apelido')).toBeFocused();
  await intruder.context().close();

  // Quem não é host vê o modo, mas não pode alterá-lo nem iniciar.
  await expect(guest.getByRole('radio', { name: /Normal/ })).toBeDisabled();
  await expect(guest.getByRole('radio', { name: /Normal/ })).toBeChecked();
  await expect(
    guest.getByRole('button', { name: 'Iniciar partida' }),
  ).toHaveCount(0);
  await expect(guest.getByRole('button', { name: /Remover/ })).toHaveCount(0);
  await capture(host, testInfo, 'mp-02-lobby-host');
  await capture(guest, testInfo, 'mp-03-lobby-guest');
  await expectAccessible(host);
  await expectAccessible(guest);

  await host.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(
    guest.getByRole('heading', { name: 'Prepare-se para o round 1' }),
  ).toBeFocused();
  await host.getByRole('button', { name: 'Estou pronto' }).click();
  await expect(
    guest.getByRole('list', { name: 'Prontidão dos participantes' }),
  ).toContainText('Pronto');
  await capture(guest, testInfo, 'mp-04-ready');
  await expectAccessible(guest);
  await guest.getByRole('button', { name: 'Estou pronto' }).click();

  for (let round = 0; round < 5; round += 1) {
    await expect(
      host.getByText(`Round ${String(round + 1)} de 5`, { exact: true }),
    ).toBeVisible();
    await waitForAttempt(host);
    await waitForAttempt(guest);
    await expect(liveRegion(host)).toBeEmpty();
    await expect(host.getByText('Tom atual')).toBeVisible();
    if (round === 0) await capture(guest, testInfo, 'mp-05-attempt');
    await answerRound(host, 1);
    await expect(
      host.getByRole('heading', { name: 'Palpites registrados' }),
    ).toBeFocused();
    const progress = host.getByRole('list', {
      name: 'Progresso dos participantes',
    });
    await expect(progress).toContainText('Concluiu');
    await expect(progress).toContainText('Jogando');
    await expect(host.getByText(/\d Hz/)).toHaveCount(0);
    if (round === 0) {
      await capture(host, testInfo, 'mp-06-waiting');
      await expectAccessible(host);
    }
    await answerRound(guest, 1);
    if (round === 4) break;
    for (const page of [host, guest]) {
      await expect(
        page.getByRole('heading', {
          name: `Resultado do round ${String(round + 1)}`,
        }),
      ).toBeFocused();
      await expect(
        page.getByRole('table', {
          name: `Palpites do round ${String(round + 1)}`,
        }),
      ).toContainText('Bia');
    }
    if (round === 0) {
      await capture(host, testInfo, 'mp-07-results-host');
      await capture(guest, testInfo, 'mp-08-results-guest');
      await expectAccessible(guest);
    }
    await readyEveryone(
      [host, guest],
      `Pronto para o round ${String(round + 2)}`,
    );
  }

  for (const page of [host, guest]) {
    await expect(
      page.getByRole('heading', { name: 'Ranking final' }),
    ).toBeFocused();
    const ranking = page.getByRole('list', { name: 'Classificação' });
    await expect(ranking.getByRole('listitem')).toHaveCount(2);
    await expect(ranking.locator('[data-self="true"]')).toHaveCount(1);
  }
  await expect(
    host.getByRole('button', { name: 'Jogar novamente' }),
  ).toBeVisible();
  await expect(
    guest.getByRole('button', { name: 'Jogar novamente' }),
  ).toHaveCount(0);
  await guest.getByText('Consultar frequências dos rounds').click();
  await expect(guest.getByRole('heading', { name: 'Round 5' })).toBeVisible();
  await capture(host, testInfo, 'mp-09-final-host');
  await capture(guest, testInfo, 'mp-10-final-guest');
  await expectAccessible(guest);

  // Jogar novamente: todos voltam ao lobby e o mesmo link aceita entradas.
  await host.getByRole('button', { name: 'Jogar novamente' }).click();
  await expect(guest.getByRole('heading', { name: 'Lobby' })).toBeFocused();
  await expect(guest.getByLabel('Link de convite')).toHaveValue(link);
  const late = await openPlayer(browser, testInfo);
  await joinByInvite(late, link, 'Caio');
  await expect(participants(host).getByRole('listitem')).toHaveCount(3);
  await host.getByRole('radio', { name: /Hard/ }).click();
  await expect(guest.getByRole('radio', { name: /Hard/ })).toBeChecked();
  expect(errors).toEqual([]);
});

test('Extreme com três frequências completa cinco rounds com valores ocultos', async ({
  page: host,
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  await host.goto('/');
  const link = await createRoom(host, 'Ana');
  const guest = await openPlayer(browser, testInfo);
  await joinByInvite(guest, link, 'Bia');
  await host.getByRole('radio', { name: /Extreme/ }).click();
  await expect(host.getByRole('radio', { name: /Extreme/ })).toBeChecked();
  await host.getByRole('radio', { name: '3 frequências' }).click();
  await expect(
    guest.getByRole('radio', { name: '3 frequências' }),
  ).toBeChecked();
  await expect(
    guest.getByRole('heading', { level: 2, name: /Extreme · 3/ }),
  ).toBeVisible();
  await host.getByRole('button', { name: 'Iniciar partida' }).click();
  await readyEveryone([host, guest], 'Estou pronto');

  for (let round = 0; round < 5; round += 1) {
    await waitForAttempt(guest);
    await expect(guest.getByText('Frequência 1 de 3')).toBeVisible();
    await expect(guest.locator('.frequency-readout')).toHaveCount(0);
    await confirmAttempt(guest);
    await expect(guest.getByText('Frequência 2 de 3')).toBeVisible();
    await expect(guest.getByText('Frequência alvo')).toHaveCount(0);
    await confirmAttempt(guest);
    await confirmAttempt(guest);
    await expect(
      guest.getByRole('heading', { name: 'Palpites registrados' }),
    ).toBeVisible();
    await answerRound(host, 3);
    if (round === 4) break;
    const table = host.getByRole('table', {
      name: `Palpites do round ${String(round + 1)}`,
    });
    await expect(table.getByRole('columnheader')).toHaveCount(5);
    if (round === 0) await capture(host, testInfo, 'mp-11-results-extreme');
    await readyEveryone(
      [host, guest],
      `Pronto para o round ${String(round + 2)}`,
    );
  }
  await expect(
    host.getByRole('heading', { name: 'Ranking final' }),
  ).toBeVisible();
  await expect(
    host.getByRole('table', { name: /Pontuação dos rounds/ }),
  ).toBeVisible();
});

test('uma pessoa sozinha joga o Hard completo e sai pelo cabeçalho', async ({
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  await page.goto('/');
  await createRoom(page, 'Solo');
  await page.getByRole('radio', { name: /Hard/ }).click();
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await page.getByRole('button', { name: 'Estou pronto' }).click();
  for (let round = 0; round < 5; round += 1) {
    await waitForAttempt(page);
    await expect(page.locator('.frequency-readout')).toHaveCount(0);
    await answerRound(page, 1);
    if (round < 4)
      await page
        .getByRole('button', {
          name: `Pronto para o round ${String(round + 2)}`,
        })
        .click();
  }
  await expect(
    page.getByRole('heading', { name: 'Ranking final' }),
  ).toBeFocused();
  await expect(
    page.getByRole('list', { name: 'Classificação' }).getByRole('listitem'),
  ).toHaveCount(1);
  await capture(page, testInfo, 'mp-12-final-solo');
  await page.getByRole('button', { name: 'Sair da sala' }).click();
  await expect(
    page.getByRole('button', { name: 'Iniciar partida' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Jogar com amigos' }),
  ).toBeFocused();
  expect(new URL(page.url()).hash).toBe('');
});

test('host remove quem está parado, sai e transfere a função', async ({
  page: host,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await host.goto('/');
  const link = await createRoom(host, 'Ana');
  const bia = await openPlayer(browser, testInfo);
  const caio = await openPlayer(browser, testInfo);
  await joinByInvite(bia, link, 'Bia');
  await joinByInvite(caio, link, 'Caio');
  await host.getByRole('button', { name: 'Iniciar partida' }).click();
  await readyEveryone([host, bia, caio], 'Estou pronto');
  await answerRound(host, 1);
  await answerRound(bia, 1);
  await waitForAttempt(caio);

  // Caio fica parado: o host o remove pela tela de espera.
  await host.getByRole('button', { name: 'Remover Caio' }).click();
  await host.getByRole('button', { name: 'Confirmar remoção de Caio' }).click();
  await expect(
    caio.getByRole('heading', { name: 'Você foi removido da sala' }),
  ).toBeFocused();
  await capture(caio, testInfo, 'mp-13-kicked');
  await expectAccessible(caio);
  await expect(
    bia.getByRole('heading', { name: 'Resultado do round 1' }),
  ).toBeVisible();
  await expect(
    bia.getByRole('table', { name: 'Palpites do round 1' }),
  ).not.toContainText('Caio');

  // Caio não volta durante a partida.
  await caio.getByRole('button', { name: 'Entrar em outra sala' }).click();
  await caio.getByLabel('Seu apelido').fill('Caio');
  await caio.getByLabel('Código da sala').fill(link.split('#sala=')[1] ?? '');
  await caio.getByRole('button', { name: 'Entrar na sala' }).click();
  await expect(caio.getByRole('alert')).toContainText('em uma partida');

  // O host fecha a aba: Bia assume e a partida continua só com ela.
  await host.context().close();
  await expect(liveRegion(bia)).toContainText('Você agora é o host da sala.');
  await expect(
    bia
      .getByRole('list', { name: 'Prontidão dos participantes' })
      .getByRole('listitem'),
  ).toHaveCount(1);
  await bia.getByRole('button', { name: 'Pronto para o round 2' }).click();
  await waitForAttempt(bia);
  await bia.getByRole('button', { name: 'Sair da sala' }).click();
  await expect(
    bia.getByRole('button', { name: 'Jogar com amigos' }),
  ).toBeFocused();
});

test('trata sala inexistente, código inválido e interrupções do round', async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await joinByCode(page, 'zzzzz-zzzzz', 'Ana');
  await expect(page.getByRole('alert')).toContainText('Sala não encontrada');
  await page.getByLabel('Código da sala').fill('abc');
  await page.getByRole('button', { name: 'Entrar na sala' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'código de 10 caracteres',
  );
  await expect(page.getByLabel('Código da sala')).toBeFocused();
  await page.getByRole('button', { name: 'Voltar ao menu' }).click();

  const link = await createRoom(page, 'Ana');
  const guest = await openPlayer(browser, testInfo);
  await joinByInvite(guest, link, 'Bia');
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await readyEveryone([page, guest], 'Estou pronto');

  // Ocultar durante a contagem não penaliza; começa com um clique.
  await expect(guest.getByText('Prepare-se para ouvir')).toBeVisible();
  await setVisible(guest, false);
  await setVisible(guest, true);
  await expect(
    guest.getByRole('button', { name: 'Começar round' }),
  ).toBeFocused();
  await capture(guest, testInfo, 'mp-14-paused-start');
  await guest.getByRole('button', { name: 'Começar round' }).click();
  await expect(guest.getByText('Ouça e memorize')).toBeVisible({
    timeout: 8000,
  });

  // Ocultar durante a referência perde o round.
  await setVisible(guest, false);
  await setVisible(guest, true);
  await expect(
    guest.getByRole('heading', { name: 'Round perdido' }),
  ).toBeFocused();

  // Ocultar durante o ajuste suspende sem penalidade.
  await waitForAttempt(page);
  await page.getByRole('button', { name: 'Aumentar tom' }).click();
  await setVisible(page, false);
  await setVisible(page, true);
  await expect(
    page.getByRole('button', { name: 'Retomar tentativa' }),
  ).toBeFocused();
  await page.getByRole('button', { name: 'Retomar tentativa' }).click();
  await waitForAttempt(page);
  await confirmAttempt(page);

  const table = page.getByRole('table', { name: 'Palpites do round 1' });
  await expect(table).toContainText('Round perdido');
  await expect(guest.getByText('Você perdeu este round')).toBeVisible();

  // Entrar durante a partida é recusado com mensagem clara.
  const late = await openPlayer(browser, testInfo);
  await late.goto(link);
  await late.getByLabel('Seu apelido').fill('Caio');
  await late.getByRole('button', { name: 'Entrar na sala' }).click();
  await expect(late.getByRole('alert')).toContainText('em uma partida');
});

test('entrada e lobby continuam utilizáveis a 320 px com texto a 200%', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await expectReflow(page);
  await page.getByRole('button', { name: 'Jogar com amigos' }).click();
  await expectReflow(page);
  await page.getByLabel('Seu apelido').fill('Ana');
  await page.getByRole('button', { name: 'Criar sala', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  await page.getByRole('radio', { name: /Extreme/ }).click();
  await expect(page.getByRole('radio', { name: /Extreme/ })).toBeChecked();
  await capture(page, testInfo, 'mp-15-lobby-320-text-200');
  await expectReflow(page);
  await page.getByRole('button', { name: 'Iniciar partida' }).click();
  await expect(
    page.getByRole('heading', { name: 'Prepare-se para o round 1' }),
  ).toBeVisible();
  await expectReflow(page);
});
