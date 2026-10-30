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
  assert.equal((await edit(radio.id,{nome:'Rádio atualizado',patrimonio:'MINA-UG'})).status,200);
  assert.equal((await MaterialService.buscarPorCodigo('RP-01')).patrimonio,'MINA-UG');
  await AuthService.criarUsuario({nome:'Consulta',matricula:'BARCODE-READ',senha:password,nivel_acesso:'CONSULTA'});
  await AuthService.criarUsuario({nome:'Operador de teste',matricula:'BARCODE-OPERATOR',senha:password,nivel_acesso:'OPERADOR'});
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/login');
  await page.getByLabel('Matrícula', { exact: true }).fill('CATEGORY-TEST');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(page).toHaveURL(base + '/');
  await expect(page.getByRole('button', { name: /SAÍDA DE MATERIAL/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /ENTRADA DE MATERIAL/ })).toHaveCount(0);
  await expect(page.locator('a[href="/cadastro"]')).toBeVisible();
  await expect(page.locator('a[href="/relatorios"]')).toBeVisible();
  await expect(page.locator('a[href="/legado"]')).toHaveCount(0);
  for (const route of ['/saida', '/entrada', '/legado']) {
    await page.goto(base + route);
    await expect(page).toHaveURL(base + '/');
  }
  await page.goto(base + '/administracao');
  await expect(page.getByRole('heading', { name: 'Administração', exact: true })).toBeVisible();
  await expect(page.locator('a[href="/legado"]')).toHaveCount(0);
  await page.goto(base + '/dashboard');
  await expect(page.getByRole('heading', { name: 'COLABORADORES NA MINA', exact: true })).toBeVisible();
  await expect(page.locator('.mine-monitor')).toHaveAttribute('data-monitor-state', 'live');
  await expect(page.getByRole('navigation', { name: 'Navegação do dashboard' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modo TV', exact: true })).toBeVisible();
  await expect(page.locator('input, select, textarea')).toHaveCount(0);
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
  await expect(page.getByRole('dialog').getByRole('textbox',{name:'Código de barras',exact:true})).toBeVisible();
  await page.getByRole('dialog').getByLabel('Patrimônio',{exact:true}).fill('MINA-UG');
  await page.getByRole('button',{name:'Salvar cadastro',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.notice.success')).toContainText('Cadastro salvo com sucesso.');
  await expect(page.getByRole('button',{name:'Vincular código de barras de RP-01',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Etiquetas PDF A4',exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Materiais',exact:true}).click();
  await categories.getByRole('button',{name:/Rádios/}).click();
  await page.getByRole('button',{name:'Abrir item RP-01',exact:true}).click();
  await expect(page.getByRole('dialog').getByLabel('Patrimônio',{exact:true})).toHaveValue('MINA-UG');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await page.getByRole('textbox',{name:'Pesquisar cadastros',exact:true}).fill('RP-01');
  await expect(page.locator('.pager')).toContainText('1 registro');
  await expect(page.getByRole('button',{name:'Abrir item RP-01',exact:true})).toBeVisible();
  const operatorPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  operatorPage.on('pageerror', error => errors.push(error.message));
  await operatorPage.goto(base + '/login');
  await operatorPage.getByLabel('Matrícula', { exact: true }).fill('BARCODE-OPERATOR');
  await operatorPage.getByLabel('Senha', { exact: true }).fill(password);
  await operatorPage.getByRole('button', { name: 'Entrar no sistema' }).click();
  await expect(operatorPage).toHaveURL(base + '/');
  await expect(operatorPage.locator('a[href="/cadastro"]')).toHaveCount(0);
  await expect(operatorPage.locator('a[href="/relatorios"]')).toHaveCount(0);
  await expect(operatorPage.getByRole('button', { name: /SAÍDA DE MATERIAL/ })).toBeVisible();
  await expect(operatorPage.getByRole('button', { name: /ENTRADA DE MATERIAL/ })).toBeVisible();
  await operatorPage.goto(base + '/cadastro');
  await expect(operatorPage).toHaveURL(base + '/');
  await operatorPage.goto(base + '/relatorios');
  await expect(operatorPage).toHaveURL(base + '/');
  await operatorPage.goto(base + '/estoque');
  await expect(operatorPage.getByRole('heading', { name: 'Estoque e disponibilidade', exact: true })).toBeVisible();
  assert.deepEqual(errors, []);
  console.log('PASS: menus e rotas por perfil, categorias, filtros, paginacao, mobile e patrimônio preservado com códigos de barras.');
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
