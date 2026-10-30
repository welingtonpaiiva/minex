const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test'), backend = path.resolve(__dirname, '../../backend');
process.env.DB_CLIENT = 'sqlite'; process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-photo-ui-')), 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex'); delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
const { query, closeDatabase } = require(path.join(backend, 'dist/config/db'));
const { runMigrations } = require(path.join(backend, 'dist/database/migrate'));
const { MaterialService } = require(path.join(backend, 'dist/services/MaterialService'));
const { app } = require(path.join(backend, 'dist/server'));
let server, browser;
(async () => {
  await runMigrations(); const actors = {};
  for (const role of ['ADMINISTRADOR', 'OPERADOR', 'CONSULTA']) {
    const user = { nome: role, matricula: role, nivel_acesso: role };
    user.id = (await query('INSERT INTO usuarios (nome,matricula,nivel_acesso,senha_hash) VALUES (?,?,?,?)', [role, role, role, 'unused']))[0].id;
    actors[role] = { user, token: jwt.sign({ id: user.id }, process.env.JWT_SECRET) };
  }
  await query("INSERT INTO colaboradores (nome,matricula,nfc_id) VALUES ('Ana Foto','ANA-FOTO','NFC-FOTO')");
  const item = await MaterialService.criar({ nome: 'Medidor de Gás', codigo_interno: 'MG-010' });
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); const base = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ channel: 'chrome', headless: true }); const errors = [];
  async function account(actor) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(({ token, user }) => { localStorage.setItem('casa_da_lanterna_token', token); localStorage.setItem('casa_da_lanterna_user', JSON.stringify(user)); }, actor);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message)); return page;
  }
  async function loaded(image) { await expect(image).toBeVisible(); await expect.poll(() => image.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true); }
  async function nfc(page) { await page.keyboard.type('NFC-FOTO', { delay: 5 }); await page.keyboard.press('Enter'); }
  const artifacts = path.resolve(__dirname, '../../test-results'); fs.mkdirSync(artifacts, { recursive: true });
  const admin = await account(actors.ADMINISTRADOR); await admin.goto(base + '/cadastro'); await admin.getByRole('button', { name: 'Materiais', exact: true }).click();
  await loaded(admin.locator('.data-table').getByRole('img', { name: 'Foto de Medidor de Gás', exact: true }));
  await admin.getByRole('button', { name: 'Abrir item MG-010', exact: true }).click();
  const registration = admin.getByRole('dialog', { name: 'Editar material', exact: true });
  await loaded(registration.locator('.photo-editor-top').getByRole('img', { name: 'Foto de Medidor de Gás', exact: true }));
  await registration.locator('input[type=file]').setInputFiles(path.resolve(__dirname, '../public/images/equipamentos/medidor-gas.png'));
  await registration.getByRole('button', { name: 'Usar esta foto', exact: true }).click();
  await registration.getByRole('button', { name: 'Salvar cadastro', exact: true }).click(); await expect(registration).toHaveCount(0);
  const saved = await MaterialService.buscarPorId(item.id); assert.match(saved.foto_url, /^\/api\/materiais\/fotos\//);
  await loaded(admin.locator('.data-table').getByRole('img', { name: 'Foto de Medidor de Gás', exact: true }));
  await admin.screenshot({ path: path.join(artifacts, 'equipment-photo-cadastro.png') });
  const reader = await account(actors.CONSULTA); await reader.goto(base + '/estoque');
  await loaded(reader.locator('.data-table').getByRole('img', { name: 'Foto de Medidor de Gás', exact: true }));
  await reader.screenshot({ path: path.join(artifacts, 'equipment-photo-consulta.png') });
  const operator = await account(actors.OPERADOR); await operator.goto(base + '/saida'); await expect(operator.getByRole('dialog')).toBeVisible(); await nfc(operator); await expect(operator.getByRole('dialog')).toHaveCount(0);
  const scan = operator.getByRole('textbox', { name: 'Código do material', exact: true }); await scan.focus(); await operator.keyboard.type('MG-010', { delay: 5 }); await operator.keyboard.press('Enter');
  await loaded(operator.locator('.data-table').getByRole('img', { name: 'Foto de Medidor de Gás', exact: true }));
  await operator.screenshot({ path: path.join(artifacts, 'equipment-photo-saida.png') });
  await operator.getByRole('button', { name: 'Confirmar retirada', exact: true }).click(); await expect(operator.getByRole('heading', { name: 'Retirada registrada', exact: true })).toBeVisible();
  await operator.goto(base + '/entrada'); const initial = operator.getByRole('dialog', { name: 'ENTRADA — APROXIME O CRACHÁ NFC', exact: true }); await expect(initial).toBeVisible(); await nfc(operator); await expect(initial).toHaveCount(0);
  const quick = operator.getByRole('dialog', { name: 'Conferir devolução rápida', exact: true });
  await loaded(quick.getByRole('img', { name: 'Foto de Medidor de Gás', exact: true }));
  await quick.getByRole('checkbox', { name: 'Receber MG-010', exact: true }).check();
  await operator.screenshot({ path: path.join(artifacts, 'equipment-photo-entrada.png') });
  await quick.getByRole('button', { name: 'Confirmar baixa', exact: true }).click(); const final = operator.getByRole('dialog', { name: 'CONFIRMAR DEVOLUÇÃO — LEIA O CRACHÁ NFC', exact: true }); await expect(final).toBeVisible(); await nfc(operator); await expect(final).toHaveCount(0); await expect(quick).toHaveCount(0);
  assert.equal((await MaterialService.buscarPorId(item.id)).foto_url, saved.foto_url); assert.equal((await MaterialService.buscarPorId(item.id)).status, 'DISPONIVEL');
  await admin.getByRole('button', { name: 'Abrir item MG-010', exact: true }).click();
  await registration.getByRole('button', { name: 'Remover foto do equipamento', exact: true }).click(); await registration.getByRole('button', { name: 'Salvar cadastro', exact: true }).click(); await expect(registration).toHaveCount(0);
  assert.equal((await MaterialService.buscarPorId(item.id)).foto_url, '');
  assert.deepEqual(errors, []); console.log('PASS: foto do catálogo, anexo no cadastro, leitura autenticada na consulta, miniaturas na retirada e devolução por NFC, persistência e remoção sem alterar operações.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
