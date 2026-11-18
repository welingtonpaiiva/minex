const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const backend = path.resolve(__dirname, '../../backend');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-quick-returns-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
const { query, queryOne, closeDatabase } = require(path.join(backend, 'dist/config/db'));
const { runMigrations } = require(path.join(backend, 'dist/database/migrate'));
const { MaterialService } = require(path.join(backend, 'dist/services/MaterialService'));
const { EmprestimoService } = require(path.join(backend, 'dist/services/EmprestimoService'));
const { quantityMove } = require(path.join(backend, 'dist/services/QuantityService'));
const { app } = require(path.join(backend, 'dist/server'));
let server, browser;
const artifacts = path.resolve(__dirname, '../../test-results');

(async () => {
  await runMigrations();
  const user = { nome: 'Operador de devoluções', matricula: 'RETURN-OP', nivel_acesso: 'OPERADOR' };
  user.id = (await query('INSERT INTO usuarios (nome, matricula, nivel_acesso, senha_hash) VALUES (?, ?, ?, ?)',
    [user.nome, user.matricula, user.nivel_acesso, 'unused']))[0].id;
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET);
  const people = [];
  for (const [name, matricula] of [['Ana Costa', 'ANA-01'], ['Bruno Lima', 'BRUNO-02']]) {
    people.push((await query('INSERT INTO colaboradores (nome, matricula, setor, nfc_id) VALUES (?, ?, ?, ?)', [name, matricula, 'Operação subterrânea', 'NFC-' + matricula]))[0].id);
  }
  const items = [];
  for (const [name, code] of [['Rádio portátil', 'RAD-ANA'], ['Lanterna de mineiro', 'LAN-ANA'], ['Luvas de proteção', 'LUV-ANA'], ['Medidor de gás', 'GAS-BRUNO']]) {
    items.push(await MaterialService.criar({ nome: name, codigo_interno: code, codigo_barras: 'BAR-' + code }));
  }
  await EmprestimoService.realizarSaida({ colaboradorId: people[0], operadorId: user.id, materiaisCodigos: ['RAD-ANA', 'LAN-ANA'], requestId: crypto.randomUUID() });
  await EmprestimoService.realizarSaida({ colaboradorId: people[1], operadorId: user.id, materiaisCodigos: ['GAS-BRUNO'], requestId: crypto.randomUUID() });
  await query("UPDATE materiais SET tipo_controle = 'QUANTIDADE', saldo_disponivel = 20 WHERE id = ?", [items[2].id]);
  await quantityMove({ tipo: 'RETIRADA', material_id: items[2].id, colaborador_id: people[0], quantidade: 6, requestId: crypto.randomUUID() }, user.id);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ token, user }) => {
    localStorage.setItem('casa_da_lanterna_token', token);
    localStorage.setItem('casa_da_lanterna_user', JSON.stringify(user));
  }, { token, user });
  const page = await context.newPage(), errors = [];
  async function readNfc(target, code) {
    await target.keyboard.type(code, { delay: 5 });
    await target.keyboard.press('Enter');
  }
  page.on('pageerror', error => errors.push(error.message));
  fs.mkdirSync(artifacts, { recursive: true });
  await page.goto(base + '/');
  await expect(page.getByRole('article', { name: 'Pessoas com materiais', exact: true }).locator('strong')).toHaveText('2');
  await expect(page.getByRole('article', { name: 'Unidades em conferência', exact: true }).locator('strong')).toHaveText('0');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, 'home-updated-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: path.join(artifacts, 'home-updated-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/entrada');await page.getByRole('button',{name:'Fechar leitor NFC',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Pessoas e materiais', exact: true })).toBeVisible();
  const ana = page.getByRole('article', { name: 'Materiais de Ana Costa', exact: true });
  const bruno = page.getByRole('article', { name: 'Materiais de Bruno Lima', exact: true });
  await expect(ana).toBeVisible(); await expect(bruno).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(ana).toContainText('8 unidades');
  fs.mkdirSync(artifacts, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(artifacts, 'quick-returns-desktop.png'), fullPage: true });
  const search = page.getByRole('textbox', { name: 'Buscar pessoas ou materiais pendentes', exact: true });
  await search.fill('RAD-ANA');
  await expect(bruno).toHaveCount(0);
  await expect(ana).toContainText('Luvas de proteção');
  await search.fill(''); await expect(bruno).toBeVisible();
  await ana.getByRole('button', { name: 'Escolher itens', exact: true }).click();
  const desktopDialog = page.getByRole('dialog', { name: 'Conferir devolução rápida', exact: true });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport);
    const layout = await desktopDialog.evaluate(node => {
      const details = node.querySelector('.return-confirm-details').getBoundingClientRect();
      const materials = node.querySelector('.return-confirm-materials').getBoundingClientRect();
      return { right: materials.left >= details.right, outerScroll: node.parentElement.scrollHeight > node.parentElement.clientHeight + 1, scrollable: [...node.querySelectorAll('*')].filter(element => {
        const style = getComputedStyle(element);
        return /auto|scroll/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
      }).length };
    });
    assert.equal(layout.right, true, 'Os materiais devem aparecer à direita da identificação.');
    assert.equal(layout.scrollable, 0, 'O modal não deve ter campos com rolagem interna.');
    assert.equal(layout.outerScroll, false, 'A conferência deve caber na altura da tela do computador.');
    for (const code of ['RAD-ANA', 'LAN-ANA', 'LUV-ANA']) await expect(desktopDialog.getByRole('checkbox', { name: 'Receber ' + code, exact: true })).toBeInViewport({ ratio: 1 });
    await expect(desktopDialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: path.join(artifacts, 'quick-returns-two-columns-' + viewport.width + '.png') });
  }
  await desktopDialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  // Reproduz a conferência longa sem alterar empréstimos ou gravar devoluções.
  const pendingRoute = '**/api/emprestimos/pendencias?*';
  await page.route(pendingRoute, async route => {
    const response = await route.fetch(), data = await response.json();
    const person = data.items.find(item => item.nome === 'Ana Costa');
    if (person) {
      const sample = person.materiais.find(item => item.tipo === 'INDIVIDUAL');
      person.materiais = Array.from({ length: 26 }, (_, index) => ({ ...sample, emprestimo_id: 10000 + index, material_id: 10000 + index, codigo_interno: 'FIX-' + String(index + 1).padStart(3, '0'), material_nome: 'Material para conferência ' + (index + 1) }));
      person.total_itens = person.total_unidades = 26;
    }
    await route.fulfill({ response, json: data });
  });
  await page.reload(); await page.getByRole('button', { name: 'Fechar leitor NFC', exact: true }).click();
  await ana.getByRole('button', { name: 'Devolver tudo', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'ENTRADA — APROXIME O CRACHÁ NFC', exact: true })).toBeVisible();
  await expect(desktopDialog).toHaveCount(0);
  await readNfc(page, 'NFC-ANA-01');
  await expect(desktopDialog).toBeVisible();
  const fixedDetails = desktopDialog.locator('.return-confirm-details'), scrolling = desktopDialog.locator('.modal-form-content');
  const originalTop = (await fixedDetails.boundingBox()).y;
  await expect(desktopDialog.getByRole('checkbox')).toHaveCount(26);
  for (const fraction of [0.5, 1]) {
    await scrolling.evaluate((node, amount) => { node.scrollTop = (node.scrollHeight - node.clientHeight) * amount; }, fraction);
    assert.ok(Math.abs((await fixedDetails.boundingBox()).y - originalTop) <= 1, 'Identificação, NFC e condição devem permanecer fixos durante toda a rolagem.');
    await expect(desktopDialog.getByRole('combobox')).toBeInViewport({ ratio: 1 });
    await expect(desktopDialog.getByRole('heading', { name: 'Conferir devolução rápida', exact: true })).toBeInViewport({ ratio: 1 });
    await expect(desktopDialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeInViewport({ ratio: 1 });
  }
  await expect(desktopDialog.getByRole('checkbox', { name: 'Receber FIX-026', exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: path.join(artifacts, 'quick-returns-fixed-panel-26-items.png') });
  await desktopDialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.unroute(pendingRoute);
  await page.reload(); await page.getByRole('button', { name: 'Fechar leitor NFC', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: path.join(artifacts, 'quick-returns-mobile.png'), fullPage: true });
  await ana.getByRole('button', { name: 'Escolher itens', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Conferir devolução rápida', exact: true });
  await expect(dialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeInViewport({ ratio: 1 });
  await dialog.locator('.modal-form-content').evaluate(node => { node.scrollTop = node.scrollHeight; });
  await expect(dialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeInViewport({ ratio: 1 });
  await dialog.locator('.modal-form-content').evaluate(node => { node.scrollTop = 0; });
  await expect(dialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Receber RAD-ANA', exact: true }).check();
  await dialog.getByRole('checkbox', { name: 'Receber LUV-ANA', exact: true }).check();
  const quantity = dialog.getByRole('spinbutton', { name: 'Quantidade a devolver de LUV-ANA', exact: true });
  await quantity.fill(''); await expect(quantity).toBeEnabled(); await quantity.fill('2');
  await expect(dialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('textbox', { name: 'Ler código de barras para devolução', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Ler ou digitar NFC', exact: true }).click();
  const nfc = page.getByRole('dialog', { name: 'DEVOLUÇÃO — LEIA O CRACHÁ NFC', exact: true });
  await expect(nfc.getByRole('button', { name: 'Digitar código NFC ou matrícula', exact: true })).toHaveCount(0);
  await readNfc(page, 'NFC-BRUNO-02');
  await expect(nfc.getByRole('alert')).toContainText('outro colaborador');
  await readNfc(page, 'ANA-01');
  await expect(nfc.getByRole('alert')).toContainText('Matrícula não substitui');
  await nfc.getByRole('button', { name: 'Digitar código NFC', exact: true }).click();
  await nfc.getByRole('textbox', { name: 'Código NFC', exact: true }).fill('NFC-BRUNO-02');
  await nfc.getByRole('button', { name: 'Identificar crachá', exact: true }).click();
  await expect(nfc.getByRole('alert')).toContainText('outro colaborador');
  await nfc.getByRole('textbox', { name: 'Código NFC', exact: true }).fill('ANA-01');
  await nfc.getByRole('button', { name: 'Identificar crachá', exact: true }).click();
  await expect(nfc.getByRole('alert')).toContainText('Matrícula não substitui');
  await nfc.getByRole('textbox', { name: 'Código NFC', exact: true }).fill('NFC-ANA-01');
  await nfc.getByRole('button', { name: 'Identificar crachá', exact: true }).click();
  await expect(nfc).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeEnabled();
  await dialog.getByRole('combobox').selectOption('CONFERENCIA');
  await page.screenshot({ path: path.join(artifacts, 'quick-returns-confirm-mobile.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await dialog.getByRole('button', { name: 'Confirmar baixa', exact: true }).click();
  await expect(page.getByRole('dialog',{name:'CONFIRMAR DEVOLU\u00c7\u00c3O \u2014 LEIA O CRACH\u00c1 NFC',exact:true})).toBeVisible(); await readNfc(page,'NFC-ANA-01');
  await expect(dialog).toHaveCount(0);
  await expect(ana).toContainText('5 unidades');
  await expect(page.locator('.notice.success')).toContainText('Recebidos, mas ainda indisponíveis.');
  assert.equal((await MaterialService.buscarPorId(items[0].id)).status, 'AGUARDANDO_CONFERENCIA');
  assert.equal((await MaterialService.buscarPorId(items[2].id)).saldo_conferencia, 2);

  // O fluxo tradicional opera no mesmo estado da nova fila.
  const traditional = await context.newPage();
  traditional.on('pageerror', error => errors.push(error.message));
  await traditional.goto(base + '/entrada');await traditional.getByRole('button',{name:'Fechar leitor NFC',exact:true}).click();
  await traditional.getByRole('button', { name: 'Equipamentos individuais', exact: true }).click();
  await expect(traditional.getByRole('dialog')).toBeVisible();
  await readNfc(traditional, 'NFC-BRUNO-02');
  await expect(traditional.getByRole('dialog')).toHaveCount(0);
  await traditional.getByRole('checkbox', { name: 'Receber Medidor de gás', exact: true }).check();
  await expect(traditional.getByRole('button', { name: 'Confirmar devolução', exact: true })).toBeEnabled();
  await traditional.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(traditional.getByRole('dialog',{name:'CONFIRMAR DEVOLU\u00c7\u00c3O \u2014 LEIA O CRACH\u00c1 NFC',exact:true})).toBeVisible(); await readNfc(traditional,'NFC-BRUNO-02');
  await expect(traditional.getByRole('heading', { name: 'Devolução registrada', exact: true })).toBeVisible();
  await expect(traditional.locator('.notice.success')).toContainText('Conferidos e aptos.');
  assert.equal((await MaterialService.buscarPorId(items[3].id)).status, 'DISPONIVEL');
  await traditional.goto(base + '/entrada');await traditional.getByRole('button',{name:'Fechar leitor NFC',exact:true}).click();
  await traditional.getByRole('button', { name: 'Materiais por quantidade', exact: true }).click();
  await expect(traditional.getByRole('dialog')).toBeVisible();
  await readNfc(traditional, 'NFC-ANA-01');
  await expect(traditional.getByRole('dialog')).toHaveCount(0);
  await traditional.getByRole('button', { name: /Luvas de proteção/ }).click();
  await expect(traditional.getByRole('button', { name: 'Confirmar devolução', exact: true })).toBeEnabled();
  await traditional.getByRole('button', { name: 'Confirmar devolução', exact: true }).click();
  await expect(traditional.getByRole('dialog',{name:'CONFIRMAR DEVOLU\u00c7\u00c3O \u2014 LEIA O CRACH\u00c1 NFC',exact:true})).toBeVisible(); await readNfc(traditional,'NFC-ANA-01');
  await expect(traditional.getByRole('heading', { name: 'Movimentação registrada', exact: true })).toBeVisible();
  await expect(traditional.locator('.notice.success')).toContainText('Conferidos e aptos.');
  // A condição escolhida em um atendimento não pode contaminar o próximo.
  await traditional.getByRole('button', { name: 'Próximo atendimento', exact: true }).click();
  await expect(traditional.getByRole('dialog')).toBeVisible();
  await readNfc(traditional, 'NFC-ANA-01');
  await expect(traditional.getByRole('dialog')).toHaveCount(0);
  await traditional.getByRole('button', { name: /Luvas de proteção/ }).click();
  await traditional.getByLabel('Condição', { exact: true }).selectOption('CONFERENCIA');
  await traditional.getByRole('button', { name: 'Trocar colaborador', exact: true }).click();
  await expect(traditional.getByRole('dialog')).toBeVisible();
  await readNfc(traditional, 'NFC-ANA-01');
  await expect(traditional.getByRole('dialog')).toHaveCount(0);
  await traditional.getByRole('button', { name: /Luvas de proteção/ }).click();
  await expect(traditional.getByLabel('Condição', { exact: true })).toHaveValue('APTO');
  await traditional.close(); await page.bringToFront();
  await expect(bruno).toHaveCount(0, { timeout: 15000 });
  await expect(ana).toContainText('4 unidades');
  await ana.getByRole('button', { name: 'Devolver tudo', exact: true }).click();
  const returnAllNfc = page.getByRole('dialog', { name: 'ENTRADA — APROXIME O CRACHÁ NFC', exact: true });
  await expect(returnAllNfc).toBeVisible();
  await readNfc(page, 'NFC-ANA-01');
  await expect(returnAllNfc).toHaveCount(0);
  dialog = page.getByRole('dialog', { name: 'Conferir devolução rápida', exact: true });
  await expect(dialog.getByRole('checkbox', { name: 'Receber LAN-ANA', exact: true })).toBeChecked();
  await expect(dialog.getByRole('spinbutton', { name: 'Quantidade a devolver de LUV-ANA', exact: true })).toHaveValue('3');
  await expect(dialog.getByRole('button', { name: 'Confirmar baixa', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Confirmar baixa', exact: true }).click();
  await expect(page.getByRole('dialog',{name:'CONFIRMAR DEVOLU\u00c7\u00c3O \u2014 LEIA O CRACH\u00c1 NFC',exact:true})).toBeVisible(); await readNfc(page,'NFC-ANA-01');
  await expect(page.getByRole('heading', { name: 'Tudo devolvido por aqui', exact: true })).toBeVisible();
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM emprestimos')).n, 0);
  assert.equal((await MaterialService.buscarPorId(items[2].id)).saldo_disponivel, 18);
  await page.goto(base + '/');
  await expect(page.getByRole('article', { name: 'Pessoas com materiais', exact: true }).locator('strong')).toHaveText('0');
  await expect(page.getByRole('article', { name: 'Unidades em conferência', exact: true }).locator('strong')).toHaveText('3');
  assert.deepEqual(errors, []);
  console.log('PASS: NFC manual e seleção dos itens na baixa rápida, tradicional e por quantidade; devolução sem código de barras e condição reiniciada entre atendimentos.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
});
