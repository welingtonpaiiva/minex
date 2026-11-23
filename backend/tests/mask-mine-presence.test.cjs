const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-mask-presence-')), 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { monitoringOverview, monitoringProfile } = require('../dist/services/MonitoringService');
const { mineOverview, mineAccess } = require('../dist/services/OperationalService');
const { ColaboradorService } = require('../dist/services/ColaboradorService');
const { MaterialService } = require('../dist/services/MaterialService');
const { EmprestimoService } = require('../dist/services/EmprestimoService');
const { quantityMove } = require('../dist/services/QuantityService');
const { app } = require('../dist/server');
const key = () => crypto.randomUUID();
let operator, server, base, token;
before(async () => {
  await runMigrations();
  operator = (await query("INSERT INTO usuarios (nome,matricula,senha_hash,nivel_acesso) VALUES ('Operador','MASK-TEST','unused','ADMINISTRADOR')"))[0].id;
  token = jwt.sign({ id: operator }, process.env.JWT_SECRET);
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
const person = () => ColaboradorService.criar({ nome: 'Pessoa ' + key(), matricula: key(), brigadista: true });
const material = (nome = 'Máscara de Fuga', categoria_id) => MaterialService.criar({ nome, categoria_id, codigo_interno: key() });
const withdraw = (p, materials) => EmprestimoService.realizarSaida({ colaboradorId: p.id, materiaisCodigos: materials.map(m => m.codigo_interno), operadorId: operator, requestId: key() });
const giveBack = (p, materials) => EmprestimoService.realizarEntrada({ colaboradorId: p.id, materiaisCodigos: materials.map(m => m.codigo_interno), operadorId: operator, requestId: key() });
const presence = async p => (await monitoringOverview()).colaboradores.filter(row => row.colaborador_id === p.id);
async function request(route) {
  const response = await fetch(base + '/api/operacao/' + route, { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200);
  return response.json();
}

test('retirada de máscara inclui presença, perfil, brigada e alerta; devolução encerra', async () => {
  const p = await person(), mask = await material();
  await withdraw(p, [mask]);
  const time = new Date(Date.now() - 9 * 3600000).toISOString();
  await query('UPDATE emprestimos SET data_hora_saida=? WHERE material_id=?', [time, mask.id]);
  const snapshot = await request('monitoramento');
  const row = snapshot.colaboradores.find(row => row.colaborador_id === p.id);
  assert.equal(row.origem, 'MASCARA_FUGA');
  assert.equal(row.possui_mascara_fuga, true);
  assert.equal(row.entrada, time);
  assert.equal(snapshot.brigadistas.presentes.some(row => row.colaborador_id === p.id), true);
  assert.equal((await request('monitoramento/perfil/' + p.id)).acesso_ativo.origem, 'MASCARA_FUGA');
  assert.equal((await request('acessos')).colaboradores.find(row => row.colaborador_id === p.id).excedido, true);
  await assert.rejects(mineAccess({ colaborador_id: p.id, tipo: 'SAIDA' }, operator), /Devolva a máscara/);
  await giveBack(p, [mask]);
  assert.equal((await presence(p)).length, 0);
  assert.equal((await monitoringProfile(p.id)).acesso_ativo, null);
  assert.equal((await queryOne('SELECT COUNT(*) AS total FROM acessos_mina WHERE colaborador_id=?', [p.id])).total, 0);
});

test('outras ferramentas e máscaras de proteção não indicam presença na mina', async () => {
  const p = await person();
  await withdraw(p, [await material('Lanterna de Mineiro'), await material('Máscara de proteção')]);
  assert.equal((await presence(p)).length, 0);
});

test('reconhece nomes sem acento, caixa mista e categoria cadastrada', async () => {
  const category = (await query('INSERT INTO categorias (nome) VALUES (?)', ['MÁSCARAS DE FUGA']))[0].id;
  for (const mask of [await material('mAsCaRa De FuGa modelo X'), await material('Autossalvador', category)]) {
    const p = await person();
    await withdraw(p, [mask]);
    assert.equal((await presence(p)).length, 1);
    await giveBack(p, [mask]);
  }
});

test('várias máscaras contam uma pessoa e a devolução parcial mantém presença', async () => {
  const p = await person(), first = await material(), second = await material();
  await withdraw(p, [first, second]);
  await query("UPDATE emprestimos SET data_hora_saida='2026-01-01 12:00:00' WHERE material_id=?", [first.id]);
  assert.equal((await presence(p)).length, 1);
  assert.equal((await presence(p))[0].entrada, '2026-01-01T15:00:00.000Z');
  await giveBack(p, [second]);
  assert.equal((await presence(p)).length, 1);
  await giveBack(p, [first]);
  assert.equal((await presence(p)).length, 0);
});

test('máscaras por quantidade mantêm presença até a devolução de todas as unidades', async () => {
  const p = await person(), mask = await material();
  await query("UPDATE materiais SET tipo_controle='QUANTIDADE', saldo_disponivel=5 WHERE id=?", [mask.id]);
  await quantityMove({ tipo: 'RETIRADA', material_id: mask.id, colaborador_id: p.id, quantidade: 2, requestId: key() }, operator);
  const loan = await queryOne('SELECT id FROM emprestimos_quantidade WHERE colaborador_id=?', [p.id]);
  assert.equal((await presence(p)).length, 1);
  for (const remaining of [1, 0]) {
    await quantityMove({ tipo: 'DEVOLUCAO', emprestimo_id: loan.id, quantidade: 1, condicao: 'APTO', requestId: key() }, operator);
    assert.equal((await presence(p)).length, remaining);
  }
});

test('acesso manual e máscara são contados uma vez; cada origem mantém presença', async () => {
  const p = await person(), mask = await material();
  const time = new Date(Date.now() - 3600000).toISOString();
  await query('INSERT INTO acessos_mina (colaborador_id,entrada,operador_entrada_id,ativo_colaborador_id) VALUES (?,?,?,?)', [p.id, time, operator, p.id]);
  await withdraw(p, [mask]);
  let rows = await presence(p);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].origem, 'ACESSO');
  assert.equal(rows[0].entrada, time);
  await giveBack(p, [mask]);
  assert.equal((await presence(p)).length, 1);
  await withdraw(p, [mask]);
  await mineAccess({ colaborador_id: p.id, tipo: 'SAIDA' }, operator);
  assert.equal((await presence(p))[0].origem, 'MASCARA_FUGA');
  await giveBack(p, [mask]);
  assert.equal((await presence(p)).length, 0);
});

test('consultas não alteram estoque, empréstimos, histórico ou auditoria', async () => {
  const p = await person(), mask = await material();
  await withdraw(p, [mask]);
  const tables = ['acessos_mina', 'emprestimos', 'emprestimos_quantidade', 'materiais', 'movimentacoes', 'auditoria'];
  const snapshot = () => Promise.all(tables.map(table => query('SELECT * FROM ' + table + ' ORDER BY id')));
  const before = await snapshot();
  await monitoringOverview(); await monitoringProfile(p.id); await mineOverview();
  assert.deepEqual(await snapshot(), before);
});
