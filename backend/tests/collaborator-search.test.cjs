const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-search-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { ColaboradorService } = require('../dist/services/ColaboradorService');
const { app } = require('../dist/server');
let server, base, token, first, second;

before(async () => {
  await runMigrations();
  const user = (await query("INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso) VALUES ('Cadastro','TEST-ADMIN','unused','ADMINISTRADOR')"))[0].id;
  token = jwt.sign({ id: user }, process.env.JWT_SECRET);
  first = await ColaboradorService.criar({ nome: 'JOÃO ÁLVARO DA CONCEIÇÃO', matricula: 'AbC-001', setor: 'MINERAÇÃO', nfc_id: 'CaRd-AbC' });
  second = await ColaboradorService.criar({ nome: 'João Álvaro da Conceição', matricula: 'aBc-002', setor: 'Oficina' });
  await ColaboradorService.criar({ nome: 'Maria Oliveira', matricula: 'XYZ-003' });
  server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  base = 'http://127.0.0.1:' + server.address().port;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await closeDatabase();
});

async function search(route, params) {
  const response = await fetch(base + '/api/' + route + '?' + new URLSearchParams(params), {
    headers: { Authorization: 'Bearer ' + token }
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('cadastro encontra nomes acentuados e matrículas com qualquer caixa', async () => {
  for (const busca of ['joão', 'JOÃO', 'JoÃo', '  joão  ', 'álvaro', 'ÁLVARO', 'conceição', 'CONCEIÇÃO', 'abc', 'ABC', 'aBc']) {
    const result = await search('operacao/conformidade', { busca });
    assert.equal(result.total, 2, busca);
    assert.deepEqual(result.items.map(item => item.id).sort(), [first.id, second.id].sort(), busca);
  }
});

test('busca mantém paginação, contagem, filtros e ausência de resultados', async () => {
  const page1 = await search('operacao/conformidade', { busca: 'JOÃO', limit: 1 });
  const page2 = await search('operacao/conformidade', { busca: 'joão', limit: 1, page: 2 });
  assert.equal(page1.total, 2);
  assert.equal(page2.total, 2);
  assert.equal(page1.items.length, 1);
  assert.equal(page2.items.length, 1);
  assert.notEqual(page1.items[0].id, page2.items[0].id);
  const filtered = await search('operacao/conformidade', { busca: 'jOãO', setor: 'Oficina', situacao: 'PENDENTE' });
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].id, second.id);
  const empty = await search('operacao/conformidade', { busca: 'inexistente' });
  assert.equal(empty.total, 0);
  assert.deepEqual(empty.items, []);
});

test('listagem de colaboradores também ignora caixa no nome, matrícula, NFC e setor', async () => {
  for (const busca of ['joão', 'JOÃO', 'abc-001', 'ABC-001', 'card-abc', 'CARD-ABC', 'mineração', 'MINERAÇÃO']) {
    const result = await search('colaboradores', { busca });
    assert.ok(result.some(item => item.id === first.id), busca);
  }
});
