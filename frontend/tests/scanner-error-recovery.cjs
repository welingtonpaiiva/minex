const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test'), backend = path.resolve(__dirname, '../../backend');
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-scanner-recovery-')), 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
const { query, queryOne, closeDatabase } = require(path.join(backend, 'dist/config/db'));
const { runMigrations } = require(path.join(backend, 'dist/database/migrate'));
const { MaterialService } = require(path.join(backend, 'dist/services/MaterialService'));
const { EmprestimoService } = require(path.join(backend, 'dist/services/EmprestimoService'));
const { app } = require(path.join(backend, 'dist/server'));
let server, browser;
(async () => {
  await runMigrations();
  const actors = [];
  for (const role of ['OPERADOR', 'ADMINISTRADOR']) {
    const user = { nome: role, matricula: role, nivel_acesso: role };
    user.id = (await query('INSERT INTO usuarios (nome,matricula,nivel_acesso,senha_hash) VALUES (?,?,?,?)', [role, role, role, 'unused']))[0].id;
    actors.push({ user, token: jwt.sign({ id: user.id }, process.env.JWT_SECRET) });
  }
  const person = (await query("INSERT INTO colaboradores (nome,matricula,nfc_id) VALUES ('Ana Scanner','SCAN-ANA','NFC-ANA')"))[0].id;
  const lamp = await MaterialService.criar({ nome: 'Lanterna', codigo_interno: 'LM-003' });
  await MaterialService.criar({ nome: 'Radio', codigo_interno: 'RP-001' });
  await MaterialService.criar({ nome: 'Medidor', codigo_interno: 'MG-001' });
  await EmprestimoService.realizarSaida({ colaboradorId: person, operadorId: actors[0].user.id, materiaisCodigos: ['LM-003', 'RP-001'], requestId: crypto.randomUUID() });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  async function account(actor) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(({ token, user }) => {
      localStorage.setItem('casa_da_lanterna_token', token);
      localStorage.setItem('casa_da_lanterna_user', JSON.stringify(user));
    }, actor);
    return context.newPage();
  }
  const page = await account(actors[0]), errors = [], lookupRequests = [], returnKeys = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/entrada-por-codigo/')) lookupRequests.push(request.url());
    if (request.method() === 'POST' && request.url().endsWith('/entrada-por-codigo')) returnKeys.push(request.headers()['idempotency-key']);
  });
  const scan = async (code, suffix = 'Enter', targetPage = page) => {
    await targetPage.keyboard.type(code, { delay: 5 });
    if (suffix) await targetPage.keyboard.press(suffix);
  };
  const recovered = async input => { await expect(input).toHaveValue(''); await expect(input).toBeFocused(); };
  await page.goto(base + '/entrada');await page.getByRole('button',{name:'Fechar leitor NFC',exact:true}).click();
  await expect(page.getByRole('heading', { name: 'Pessoas e materiais', exact: true })).toBeVisible();
  await page.evaluate(() => { document.activeElement?.blur(); document.body.tabIndex = -1; document.body.focus(); });
  await scan('BAD-000');
  const input = page.getByRole('textbox', { name: 'Código do item para devolução', exact: true });
  await expect(page.getByRole('alert')).toBeVisible(); await recovered(input);
  await scan('BAD-000'); await recovered(input);
  assert.equal(lookupRequests.filter(url => url.endsWith('/BAD-000')).length, 2, 'Um erro deve permitir consultar o mesmo código novamente.');
  await page.route('**/api/emprestimos/entrada-por-codigo/TEMP-ERR', route => route.fulfill({ status: 503, json: { error: 'Falha temporária de consulta' } }));
  await scan('TEMP-ERR', 'Tab'); await expect(page.getByRole('alert')).toContainText('Falha temporária'); await recovered(input);
  await scan('LM-003'); await expect(input).toHaveValue('LM-003');
  const confirm = page.getByRole('button', { name: 'Confirmar devolução por código', exact: true });
  await page.getByRole('checkbox').check();
  await page.route('**/api/emprestimos/entrada-por-codigo', route => route.fulfill({ status: 503, json: { error: 'Falha temporária ao registrar' } }), { times: 1 });
  await confirm.click(); await expect(page.getByRole('alert')).toContainText('Falha temporária ao registrar'); await recovered(input);
  await expect(page.getByRole('checkbox')).toBeChecked(); await expect(confirm).toBeEnabled();
  assert.equal((await MaterialService.buscarPorId(lamp.id)).status, 'EM_USO');
  await confirm.click(); await expect(page.locator('.notice.success')).toContainText('LM-003');
  assert.equal(returnKeys.length, 2); assert.ok(returnKeys[0]); assert.equal(returnKeys[0], returnKeys[1], 'Nova tentativa mantém a chave contra duplicação.');
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_id=? AND tipo='ENTRADA'", [lamp.id])).n, 1);
  await scan('LM-003'); await expect(page.getByText('Este item não possui devolução ou conferência pendente.', { exact: true })).toBeVisible(); await recovered(input);

  await page.goto(base + '/saida');
  const nfc = page.getByRole('dialog');
  await nfc.getByRole('button', { name: 'Digitar código NFC ou matrícula', exact: true }).click();
  const nfcInput = nfc.getByRole('textbox', { name: 'Código NFC ou matrícula', exact: true });
  await nfcInput.fill('NFC-INVALIDO'); await nfc.getByRole('button', { name: 'Identificar crachá', exact: true }).click();
  await expect(nfc.getByRole('alert')).toBeVisible(); await recovered(nfcInput);
  await scan('NFC-ANA'); await expect(nfc).toHaveCount(0);
  const withdrawal = page.getByRole('textbox', { name: 'Código do material', exact: true }); await expect(withdrawal).toBeFocused();
  await scan('BAD-000'); await expect(page.getByRole('alert')).toBeVisible(); await recovered(withdrawal);
  await scan('RP-001'); await expect(page.getByRole('alert')).toContainText('Material indisponível'); await recovered(withdrawal);
  await scan('LM-003'); await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await scan('LM-003'); await expect(page.getByRole('alert')).toContainText('já está na lista'); await recovered(withdrawal);
  await scan('MG-001', 'Tab'); await expect(page.locator('.data-table tbody tr')).toHaveCount(2);

  await page.goto(base + '/entrada');await page.getByRole('button',{name:'Fechar leitor NFC',exact:true}).click();
  await page.getByRole('article', { name: 'Materiais de Ana Scanner', exact: true }).getByRole('button', { name: 'Escolher itens', exact: true }).click();
  const quick = page.getByRole('dialog', { name: 'Conferir devolução rápida', exact: true });
  await quick.getByRole('button', { name: 'Ler ou digitar NFC', exact: true }).click();
  const quickNfc = page.getByRole('dialog', { name: 'DEVOLUÇÃO — LEIA O CRACHÁ NFC', exact: true });
  await quickNfc.getByRole('button', { name: 'Digitar código NFC', exact: true }).click();
  await quickNfc.getByRole('textbox', { name: 'Código NFC', exact: true }).fill('NFC-ANA');
  await quickNfc.getByRole('button', { name: 'Identificar crachá', exact: true }).click(); await expect(quickNfc).toHaveCount(0);
  const optional = quick.getByRole('textbox', { name: 'Ler código de barras para devolução', exact: true }); await optional.focus();
  await scan('BAD-000'); await expect(quick.getByRole('alert')).toContainText('não pertence'); await recovered(optional);
  await scan('RP-001'); await expect(quick.getByRole('checkbox', { name: 'Receber RP-001', exact: true })).toBeChecked();

  const admin = await account(actors[1]); admin.on('pageerror', error => errors.push(error.message));
  await admin.goto(base + '/cadastro'); await admin.getByRole('button', { name: 'Materiais', exact: true }).click();
  await admin.getByRole('button', { name: 'Vincular código de barras de RP-001', exact: true }).click();
  const link = admin.getByRole('dialog', { name: 'Vincular código de barras', exact: true });
  const barcode = link.getByRole('textbox', { name: 'Código de barras', exact: true });
  await barcode.fill('LM-003'); await link.getByRole('button', { name: 'Salvar código de barras', exact: true }).click();
  await expect(link.getByRole('alert')).toBeVisible(); await recovered(barcode);
  await scan('000987650001', 'Enter', admin); await expect(barcode).toHaveValue('000987650001');
  await link.getByRole('button', { name: 'Salvar código de barras', exact: true }).click(); await expect(link).toHaveCount(0);
  await admin.getByRole('button', { name: 'Novo material', exact: true }).click();
  const registration = admin.getByRole('dialog');
  await registration.getByLabel('Nome do material', { exact: true }).fill('Teste cadastro');
  await registration.getByLabel('Código interno', { exact: true }).fill('TEST-001');
  const registrationCode = registration.getByRole('textbox', { name: 'Código de barras', exact: true });
  await registrationCode.fill('LM-003'); await registration.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
  await expect(registration.getByRole('alert')).toBeVisible(); await recovered(registrationCode);
  await expect(registration.getByLabel('Nome do material', { exact: true })).toHaveValue('Teste cadastro');
  assert.deepEqual(errors, []);
  console.log('PASS: campos limpos e focados após código desconhecido, indisponível, duplicado, NFC inválido, falha de consulta/gravação e conflito de cadastro; próxima leitura limpa, seleção e tentativa segura preservadas.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
});
