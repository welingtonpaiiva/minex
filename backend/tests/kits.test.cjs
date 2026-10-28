const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-kits-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'kits.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { EmprestimoService: loans } = require('../dist/services/EmprestimoService');
const { MaterialService: materials } = require('../dist/services/MaterialService');
const { app } = require('../dist/server');
let server, base, sequence = 0;
const operators = [];

async function request(route, body, operator = operators[0]) {
  const response = await fetch(base + '/api/' + route, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + operator.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}
async function collaborator() {
  const matricula = 'KIT-PERSON-' + ++sequence;
  const row = (await query('INSERT INTO colaboradores (nome, matricula, nfc_id) VALUES (?, ?, ?)',
    ['Pessoa ' + sequence, matricula, 'NFC-' + matricula]))[0];
  return { id: row.id, nfc: 'NFC-' + matricula };
}
async function kit(count = 1) {
  const nome = 'CESTO-' + ++sequence;
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(await materials.criar({ nome: 'Material ' + nome, codigo_interno: nome + '-' + i }));
  }
  const result = await request('kits', { nome, materiaisCodigos: items.map(item => item.codigo_interno) });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return { ...result.data, items };
}
async function counts() {
  return Promise.all(['emprestimos', 'movimentacoes', 'auditoria', 'requisicoes'].map(async table =>
    (await queryOne('SELECT COUNT(*) AS total FROM ' + table)).total));
}
async function returnItems(person, items) {
  return loans.realizarEntrada({ colaboradorId: person.id, operadorId: operators[0].id,
    materiaisCodigos: items.map(item => item.codigo_interno), requestId: crypto.randomUUID() });
}
before(async () => {
  await runMigrations();
  for (let i = 0; i < 2; i++) {
    const row = (await query('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso) VALUES (?, ?, ?, ?)',
      ['Operador ' + i, 'KIT-OP-' + i, 'unused-in-test', 'OPERADOR']))[0];
    operators.push({ id: row.id, token: jwt.sign({ id: row.id }, process.env.JWT_SECRET, { expiresIn: '1h' }) });
  }
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
});

test('segundo kit é bloqueado por ID e NFC sem alterar reservas, empréstimos ou histórico', async () => {
  const person = await collaborator(), first = await kit(2), second = await kit();
  assert.equal((await request(`kits/${first.id}/atribuir`, { colaboradorId: person.id })).status, 200);
  const before = await counts();
  for (const identity of [{ colaboradorId: person.id }, { nfcId: person.nfc }]) {
    const blocked = await request(`kits/${second.id}/atribuir`, identity);
    assert.equal(blocked.status, 400);
    assert.ok(blocked.data.error.includes(first.nome));
    assert.match(blocked.data.error, /já possui.*devolução pendente/);
    assert.deepEqual(await counts(), before);
    assert.equal((await materials.buscarPorId(second.items[0].id)).status, 'RESERVADO_KIT');
    assert.ok(await queryOne('SELECT id FROM kits WHERE id = ?', [second.id]));
  }
});

test('devolução parcial mantém bloqueio e devolução completa permite outro kit com empréstimo avulso ativo', async () => {
  const person = await collaborator(), first = await kit(2), second = await kit();
  const single = await materials.criar({ nome: 'Avulso', codigo_interno: 'AVULSO-KIT' });
  await loans.realizarSaida({ colaboradorId: person.id, operadorId: operators[0].id,
    materiaisCodigos: [single.codigo_interno], requestId: crypto.randomUUID() });
  assert.equal((await request(`kits/${first.id}/atribuir`, { colaboradorId: person.id })).status, 200);
  await returnItems(person, [first.items[0]]);
  assert.equal((await request(`kits/${second.id}/atribuir`, { colaboradorId: person.id })).status, 400);
  await returnItems(person, [first.items[1]]);
  assert.equal((await request(`kits/${second.id}/atribuir`, { nfcId: person.nfc })).status, 200);
  assert.equal((await materials.buscarPorId(single.id)).status, 'EM_USO');
});

test('operadores concorrentes entregam apenas um kit ao mesmo colaborador', async () => {
  const person = await collaborator(), kits = [await kit(), await kit()];
  const results = await Promise.all(kits.map((kit, index) =>
    request(`kits/${kit.id}/atribuir`, { colaboradorId: person.id }, operators[index])));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
  const rejected = results.findIndex(result => result.status === 400);
  assert.equal((await materials.buscarPorId(kits[rejected].items[0].id)).status, 'RESERVADO_KIT');
  const active = await query('SELECT * FROM emprestimos WHERE colaborador_id = ?', [person.id]);
  assert.equal(active.length, 1);
  assert.ok(active[0].kit_nome);
});

test('falha durante a retirada reverte liberação, empréstimos, histórico e auditoria de todo o kit', async () => {
  const person = await collaborator(), basket = await kit(2);
  await query("UPDATE materiais SET tipo_controle = 'QUANTIDADE' WHERE id = ?", [basket.items[1].id]);
  const before = await counts();
  const rejected = await request(`kits/${basket.id}/atribuir`, { colaboradorId: person.id });
  assert.equal(rejected.status, 400);
  assert.deepEqual(await counts(), before);
  for (const item of basket.items) assert.equal((await materials.buscarPorId(item.id)).status, 'RESERVADO_KIT');
  assert.ok(await queryOne('SELECT id FROM kits WHERE id = ?', [basket.id]));
});

test('atualização recupera kits antigos e não confunde item devolvido e retirado avulso', async () => {
  const person = await collaborator(), first = await kit(2), second = await kit();
  assert.equal((await request(`kits/${first.id}/atribuir`, { colaboradorId: person.id })).status, 200);
  await returnItems(person, [first.items[0]]);
  await loans.realizarSaida({ colaboradorId: person.id, operadorId: operators[0].id,
    materiaisCodigos: [first.items[0].codigo_interno], requestId: crypto.randomUUID() });
  // Simular o banco anterior à inclusão do vínculo do kit no empréstimo.
  await query('ALTER TABLE emprestimos DROP COLUMN kit_nome');
  await runMigrations();
  assert.equal((await queryOne('SELECT kit_nome FROM emprestimos WHERE material_id = ?', [first.items[0].id])).kit_nome, null);
  assert.equal((await queryOne('SELECT kit_nome FROM emprestimos WHERE material_id = ?', [first.items[1].id])).kit_nome, first.nome);
  assert.equal((await request(`kits/${second.id}/atribuir`, { colaboradorId: person.id })).status, 400);
  await runMigrations();
  await returnItems(person, [first.items[1]]);
  assert.equal((await request(`kits/${second.id}/atribuir`, { colaboradorId: person.id })).status, 200);
});
