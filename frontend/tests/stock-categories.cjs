const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');

const backend = path.resolve(__dirname, '../../backend');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-categories-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, closeDatabase, withTransaction } = require(path.join(backend, 'dist/config/db'));
const { runMigrations } = require(path.join(backend, 'dist/database/migrate'));
const { MaterialService } = require(path.join(backend, 'dist/services/MaterialService'));
const { AuthService } = require(path.join(backend, 'dist/services/AuthService'));
const { app } = require(path.join(backend, 'dist/server'));
let server, browser;

(async () => {
  await runMigrations();
  const batches = [
    { prefix: 'RP', nome: 'Rádios', total: 3 },
    { prefix: 'LM', nome: 'Lanternas de Mineiro', total: 31 },
    { prefix: 'MG', nome: 'Medidores de Gás', total: 2 },
    { prefix: 'BR', nome: 'Baterias de Rádio', total: 2 },
  ];
  await withTransaction(async () => {
    for (const batch of batches) {
      batch.id = (await query('INSERT INTO categorias (nome) VALUES (?)', [batch.nome]))[0].id;
      for (let number = batch.total; number >= 1; number--) {
        await MaterialService.criar({ nome: batch.nome, codigo_interno: batch.prefix + '-' + String(number).padStart(2, '0'), categoria_id: batch.id });
      }
    }
    await MaterialService.criar({ nome: 'Material sem categoria', codigo_interno: 'AV-01' });
    await query("UPDATE materiais SET status='BLOQUEADO' WHERE codigo_interno='BR-02'");
  });
  const password = crypto.randomBytes(24).toString('hex');
  await AuthService.criarUsuario({ nome: 'Teste de categorias', matricula: 'CATEGORY-TEST', senha: password, nivel_acesso: 'ADMINISTRADOR' });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula: 'CATEGORY-TEST', senha: password }) });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  async function stock(params = {}) {
    const response = await fetch(base + '/api/estoque?' + new URLSearchParams(params), { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200);
    return response.json();
  }
  async function edit(id, data, bearer = token) {
    const response = await fetch(base + '/api/materiais/' + id, {
      method: 'PUT', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  }
  const all = await stock({ limit: 100 });
  assert.equal(all.total, 39);
  assert.deepEqual(all.categorias.map(c => c.nome), ['Baterias de Rádio', 'Lanternas de Mineiro', 'Medidores de Gás', 'Rádios', 'Sem categoria']);
  assert.equal(all.categorias.reduce((sum, c) => sum + c.total, 0), 39);
  assert.deepEqual(all.items.map(m => m.codigo_interno), [
    'BR-01', 'BR-02', ...Array.from({ length: 31 }, (_, i) => 'LM-' + String(i + 1).padStart(2, '0')),
    'MG-01', 'MG-02', 'RP-01', 'RP-02', 'RP-03', 'AV-01',
  ]);
  const batteries = await stock({ categoria_id: batches[3].id, status: 'DISPONIVEL' });
  assert.equal(batteries.total, 1);
  assert.deepEqual(batteries.contadores, { BLOQUEADO: 1, DISPONIVEL: 1 });
  assert.equal(batteries.categorias.find(c => c.id === batches[3].id).total, 2);
  assert.equal((await stock({ categoria_id: 'sem-categoria' })).items[0].codigo_interno, 'AV-01');
  assert.equal((await stock({ categoria_id: batches[1].id, busca: 'RP-' })).total, 0);

  const radio = await MaterialService.buscarPorCodigo('RP-01');
  const otherRadio = await MaterialService.buscarPorCodigo('RP-02');
  const changed = await edit(radio.id, { codigo_barras: '  0012345678905  ' });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.codigo_barras, '0012345678905');
  assert.equal(changed.data.codigo_interno, 'RP-01');
  assert.equal(changed.data.status, radio.status);
  assert.equal((await MaterialService.buscarPorCodigo('0012345678905')).id, radio.id);
  assert.equal((await MaterialService.buscarPorCodigo('RP-01')).id, radio.id);
  assert.equal((await stock({ busca: '0012345678905' })).total, 1);
  for (const code of ['0012345678905', 'LM-01', 'x'.repeat(256), null, 123]) {
    assert.equal((await edit(otherRadio.id, { codigo_barras: code, patrimonio: 'Must not save' })).status, 400);
    assert.equal((await MaterialService.buscarPorCodigo('RP-02')).codigo_barras, 'RP-02');
    assert.equal((await MaterialService.buscarPorCodigo('RP-02')).patrimonio, otherRadio.patrimonio);
  }
  assert.equal((await edit(radio.id, { codigo_barras: '  ' })).data.codigo_barras, 'RP-01');
  await edit(radio.id, { codigo_barras: '0012345678905' });
  assert.equal((await edit(radio.id, { observacao: 'Barcode unchanged' })).data.codigo_barras, '0012345678905');
  await assert.rejects(MaterialService.criar({ nome: 'Ambiguous TAG', codigo_interno: '0012345678905' }));
  await assert.rejects(MaterialService.criar({ nome: 'Ambiguous barcode', codigo_interno: 'NEW-01', codigo_barras: 'RP-01' }));
  await AuthService.criarUsuario({ nome: 'Consulta', matricula: 'BARCODE-READ', senha: password, nivel_acesso: 'CONSULTA' });
  const readLogin = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula: 'BARCODE-READ', senha: password }) });
  const readToken = (await readLogin.json()).token;
  assert.equal((await edit(radio.id, { codigo_barras: 'NO-ACCESS' }, readToken)).status, 403);
  assert.equal((await MaterialService.buscarPorCodigo('RP-01')).codigo_barras, '0012345678905');

  await AuthService.criarUsuario({ nome: 'Operador de teste', matricula: 'BARCODE-OPERATOR', senha: password, nivel_acesso: 'OPERADOR' });
  const operatorLogin = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula: 'BARCODE-OPERATOR', senha: password }) });
  assert.equal(operatorLogin.status, 200);
  const operatorToken = (await operatorLogin.json()).token;
  async function linkBarcode(data, bearer = operatorToken) {
    const response = await fetch(base + '/api/materiais/' + otherRadio.id + '/codigo-barras', {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + bearer, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await linkBarcode({ codigo_barras: '0012300012300', nome: 'Must not change', status: 'INATIVO' })).status, 200);
  const linkedRadio = await MaterialService.buscarPorCodigo('0012300012300');
  assert.equal(linkedRadio.id, otherRadio.id);
  assert.equal(linkedRadio.nome, otherRadio.nome);
  assert.equal(linkedRadio.status, otherRadio.status);
  assert.equal(linkedRadio.codigo_interno, otherRadio.codigo_interno);
  const barcodeAudit = (await query("SELECT * FROM auditoria WHERE acao='VINCULAR_CODIGO_BARRAS' ORDER BY id DESC LIMIT 1"))[0];
  assert.equal(barcodeAudit.referencia_id, otherRadio.id);
  assert.deepEqual(JSON.parse(barcodeAudit.detalhes), { codigo_interno: 'RP-02', anterior: 'RP-02', novo: '0012300012300' });
  assert.equal((await edit(otherRadio.id, { nome: 'Not allowed' }, operatorToken)).status, 403);
  assert.equal((await linkBarcode({ codigo_barras: 'NO-ACCESS' }, readToken)).status, 403);
  assert.equal((await linkBarcode({ codigo_barras: '0012345678905' })).status, 400);
  assert.equal((await linkBarcode({})).status, 400);
  assert.equal((await MaterialService.buscarPorCodigo('RP-02')).codigo_barras, '0012300012300');

  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/login');
  await page.getByLabel('Matrícula', { exact: true }).fill('CATEGORY-TEST');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page).toHaveURL(base + '/');
  await page.goto(base + '/estoque');
  const categories = page.getByRole('region', { name: 'Categorias de materiais' });
  await expect(categories.getByRole('button', { name: /Todas as categorias/ })).toContainText('39');
  await categories.getByRole('button', { name: /Lanternas de Mineiro/ }).click();
  await expect(page.locator('.pager')).toContainText('31 registros');
  await expect(page.locator('.data-table tbody tr:not(.material-category-row)')).toHaveCount(30);
  await expect(page.locator('.data-table tbody tr:not(.material-category-row)').first()).toContainText('LM-01');
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.locator('.pager')).toContainText('Página 2 de 2');
  await expect(page.locator('.data-table tbody tr:not(.material-category-row)').first()).toContainText('LM-31');
  await categories.getByRole('button', { name: /Rádios/ }).click();
  await expect(page.locator('.pager')).toContainText('3 registros · Página 1 de 1');
  await expect(page.locator('.material-category-row')).toHaveText('Rádios');
  await expect(categories.getByRole('button', { name: /Rádios/ })).toHaveAttribute('aria-pressed', 'true');
  await categories.getByRole('button', { name: /Sem categoria/ }).click();
  await expect(page.locator('.pager')).toContainText('1 registro');
  await expect(page.locator('.material-category-row')).toHaveText('Sem categoria');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/cadastro');
  await page.getByRole('button', { name: 'Materiais', exact: true }).click();
  await categories.getByRole('button', { name: /Rádios/ }).click();
  await expect(page.locator('.pager')).toContainText('3 registros');
  await expect(page.locator('.material-category-row')).toHaveText('Rádios');
  await page.getByRole('button', { name: 'Novo material' }).click();
  await expect(page.getByRole('dialog').getByRole('combobox', { name: 'Categoria', exact: true })).toHaveValue(String(batches[0].id));
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir item RP-01', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Código interno', exact: true })).toBeDisabled();
  const barcode = page.getByRole('dialog').getByRole('textbox', { name: 'Código de barras', exact: true });
  await expect(barcode).toBeEnabled();
  await expect(barcode).toHaveValue('0012345678905');
  await barcode.fill('0098765432105');
  await barcode.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.notice.success')).toContainText('Cadastro salvo com sucesso.');
  await expect(page.getByRole('button', { name: 'Abrir item RP-01', exact: true }).locator('..').locator('..')).toContainText('0098765432105');
  assert.equal((await MaterialService.buscarPorCodigo('0098765432105')).id, radio.id);
  await page.reload();
  await page.getByRole('button', { name: 'Materiais', exact: true }).click();
  await categories.getByRole('button', { name: /Rádios/ }).click();
  await page.getByRole('button', { name: 'Abrir item RP-01', exact: true }).click();
  await expect(barcode).toHaveValue('0098765432105');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir item RP-02', exact: true }).click();
  await barcode.fill('0098765432105');
  await page.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Este código de barras já está vinculado a outro material.');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await page.getByRole('textbox', { name: 'Pesquisar cadastros', exact: true }).fill('0098765432105');
  await expect(page.locator('.pager')).toContainText('1 registro');
  await expect(page.getByRole('button', { name: 'Abrir item RP-01', exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  const artifacts = path.resolve(backend, '.runtime');
  fs.mkdirSync(artifacts, { recursive: true });
  await page.screenshot({ path: path.join(artifacts, 'categorias-cadastro.png'), fullPage: true });
  const operatorPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  operatorPage.on('pageerror', error => errors.push(error.message));
  await operatorPage.goto(base + '/login');
  await operatorPage.getByLabel('Matrícula', { exact: true }).fill('BARCODE-OPERATOR');
  await operatorPage.getByLabel('Senha', { exact: true }).fill(password);
  await operatorPage.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(operatorPage).toHaveURL(base + '/');
  await operatorPage.goto(base + '/cadastro');
  await operatorPage.getByRole('button', { name: 'Materiais', exact: true }).click();
  await operatorPage.getByRole('region', { name: 'Categorias de materiais' }).getByRole('button', { name: /Rádios/ }).click();
  await operatorPage.getByRole('button', { name: 'Vincular código de barras de RP-02', exact: true }).click();
  await expect(operatorPage.getByRole('button', { name: 'Novo material', exact: true })).toHaveCount(0);
  await expect(operatorPage.getByRole('button', { name: 'Editar', exact: true })).toHaveCount(0);
  const operatorBarcode = operatorPage.getByRole('dialog').getByRole('textbox', { name: 'Código de barras', exact: true });
  await expect(operatorBarcode).toHaveValue('0012300012300');
  await operatorBarcode.fill('0001112223334');
  await operatorBarcode.press('Enter');
  await expect(operatorPage.getByRole('dialog')).toBeVisible();
  await operatorPage.getByRole('button', { name: 'Salvar código de barras', exact: true }).click();
  await expect(operatorPage.getByRole('dialog')).toHaveCount(0);
  await expect(operatorPage.locator('.notice.success')).toContainText('Código de barras salvo para a TAG RP-02.');
  assert.equal((await MaterialService.buscarPorCodigo('0001112223334')).id, otherRadio.id);
  await operatorPage.getByRole('button', { name: 'Abrir item RP-02', exact: true }).click();
  await expect(operatorBarcode).toHaveValue('0001112223334');
  await operatorPage.screenshot({ path: path.join(artifacts, 'codigo-barras-operador.png'), fullPage: true });
  assert.deepEqual(errors, []);
  console.log('PASS: categorias, filtros, paginacao, mobile, edicao de codigos e vinculacao por operador com auditoria e permissoes.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
  for (const filename of ['test.db', 'test.db-wal', 'test.db-shm']) {
    const target = path.join(folder, filename);
    if (fs.existsSync(target)) fs.unlinkSync(target);
  }
  fs.rmdirSync(folder);
});
