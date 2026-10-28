const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium, expect } = require('@playwright/test');
const backend = path.resolve(__dirname, '../../backend');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-kit-ui-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const jwt = require(path.join(backend, 'node_modules/jsonwebtoken'));
const { query, queryOne, closeDatabase } = require(path.join(backend, 'dist/config/db'));
const { runMigrations } = require(path.join(backend, 'dist/database/migrate'));
const { MaterialService } = require(path.join(backend, 'dist/services/MaterialService'));
const { app } = require(path.join(backend, 'dist/server'));
let server, browser;

(async () => {
  await runMigrations();
  const user = { nome: 'Operador de kits', matricula: 'KIT-UI-OP', nivel_acesso: 'OPERADOR' };
  user.id = (await query('INSERT INTO usuarios (nome, matricula, nivel_acesso, senha_hash) VALUES (?, ?, ?, ?)',
    [user.nome, user.matricula, user.nivel_acesso, 'unused-in-test']))[0].id;
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const people = [];
  for (const name of ['Com kit', 'Sem kit']) {
    people.push((await query('INSERT INTO colaboradores (nome, matricula) VALUES (?, ?)', [name, name]))[0].id);
  }
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function post(route, data) {
    const response = await fetch(base + '/api/' + route, { method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.ok(response.ok);
    return response.json();
  }
  const kits = [];
  for (const code of ['KIT-ATUAL', 'KIT-NOVO']) {
    await MaterialService.criar({ nome: code, codigo_interno: code });
    kits.push(await post('kits', { nome: code, materiaisCodigos: [code] }));
  }
  await post(`kits/${kits[0].id}/atribuir`, { colaboradorId: people[0] });
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('casa_da_lanterna_token', token);
    localStorage.setItem('casa_da_lanterna_user', JSON.stringify(user));
  }, { token, user });
  await page.goto(base + '/saida');
  await page.getByRole('button', { name: 'Fechar leitor NFC', exact: true }).click();
  await page.getByRole('button', { name: /Kits Pré-Montados/ }).click();
  await page.getByRole('button', { name: 'Dispensar via NFC', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Digitar código NFC ou matrícula', exact: true }).click();
  const code = dialog.getByRole('textbox', { name: 'Código NFC ou matrícula', exact: true });
  await code.fill('Com kit');
  await dialog.getByRole('button', { name: 'Identificar crachá', exact: true }).click();
  await expect(dialog).toContainText('já possui o kit "KIT-ATUAL" com devolução pendente');
  await expect(code).toBeVisible();
  assert.ok(await queryOne('SELECT id FROM kits WHERE id = ?', [kits[1].id]));
  await code.fill('Sem kit');
  await dialog.getByRole('button', { name: 'Identificar crachá', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Kit despachado!', exact: true })).toBeVisible();
  await expect(dialog).toHaveCount(0);
  assert.equal((await queryOne('SELECT colaborador_id FROM emprestimos WHERE kit_nome = ?', ['KIT-NOVO'])).colaborador_id, people[1]);
  assert.deepEqual(errors, []);
  console.log('PASS: bloqueio de segundo kit visível no leitor NFC e nova tentativa com outro colaborador.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
});
