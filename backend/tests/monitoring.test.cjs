const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-monitoring-'));
process.env.DB_CLIENT = 'sqlite'; process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex'); process.env.APP_TIMEZONE = 'America/Sao_Paulo';
delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { monitoringOverview } = require('../dist/services/MonitoringService');
const { ColaboradorService: collaborators } = require('../dist/services/ColaboradorService');
const { mineAccess, saveTraining } = require('../dist/services/OperationalService');
const { today } = require('../dist/utils/time');
const { app } = require('../dist/server');
let user, token, server, base, brigade, outside, regular;
before(async () => {
  await runMigrations();
  user = (await query("INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso) VALUES ('Monitor','MONITOR','unused','ADMINISTRADOR')"))[0].id;
  token = jwt.sign({ id: user }, process.env.JWT_SECRET);
  brigade = await collaborators.criar({ nome: 'Brigadista de teste', matricula: 'BR-1', empresa: 'Empresa cadastrada', turma: 'C', cargo: 'Técnico', brigadista: true, brigada_especialidade: 'Primeiros socorros', brigada_validade: '2000-01-01' });
  outside = await collaborators.criar({ nome: 'Brigadista fora da mina', matricula: 'BR-2', brigadista: true });
  regular = await collaborators.criar({ nome: 'Pessoa sem classificação na brigada', matricula: 'REG-1', setor: 'TURMA A', cargo: 'Brigadista no cargo não é classificação' });
  for (const person of [brigade, regular]) {
    await query('INSERT INTO acessos_mina (colaborador_id, entrada, operador_entrada_id, ativo_colaborador_id) VALUES (?, ?, ?, ?)',
      [person.id, new Date(Date.now() - 7 * 3600000).toISOString(), user, person.id]);
  }
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });

test('cadastro persiste os metadados e edições parciais preservam a classificação', async () => {
  await collaborators.editar(brigade.id, { cargo: 'Técnico de segurança' });
  const updated = await collaborators.buscarPorId(brigade.id);
  assert.equal(updated.empresa, 'Empresa cadastrada'); assert.equal(updated.turma, 'C');
  assert.equal(updated.brigadista, 1); assert.equal(updated.brigada_validade, '2000-01-01');
  await assert.rejects(collaborators.editar(brigade.id, { brigada_validade: '2026-02-30' }), /Validade/);
  await assert.rejects(collaborators.editar(brigade.id, { brigadista: 'sim' }), /brigadista/);
});
test('presença e habilitação são distintas e cargo não é usado para inventar brigadistas', async () => {
  const snapshot = await monitoringOverview();
  assert.equal(snapshot.colaboradores.length, 2);
  assert.equal(snapshot.brigadistas.total, 2); assert.equal(snapshot.brigadistas.na_mina, 1); assert.equal(snapshot.brigadistas.fora_mina, 1);
  assert.equal(snapshot.brigadistas.presentes[0].colaborador_id, brigade.id);
  assert.equal(snapshot.brigadistas.presentes[0].habilitacao, 'VENCIDA');
  assert.equal(snapshot.colaboradores.find(person => person.colaborador_id === regular.id).turma, 'A');
  assert.equal(snapshot.fuso_horario, 'America/Sao_Paulo'); assert.equal(snapshot.limite_segundos, 21600);
});
test('horário legado é normalizado e registros inconsistentes não derrubam o painel', async () => {
  await query("UPDATE acessos_mina SET entrada='2026-01-01 12:00:00' WHERE colaborador_id=?", [brigade.id]);
  let snapshot = await monitoringOverview();
  assert.equal(snapshot.colaboradores.find(person => person.colaborador_id === brigade.id).entrada, '2026-01-01T15:00:00.000Z');
  await query("UPDATE acessos_mina SET entrada='não-é-data' WHERE colaborador_id=?", [brigade.id]);
  snapshot = await monitoringOverview();
  assert.equal(snapshot.inconsistencias, 1);
  assert.equal(snapshot.colaboradores.find(person => person.colaborador_id === brigade.id).entrada, null);
  await query('UPDATE acessos_mina SET entrada=? WHERE colaborador_id=?', [new Date().toISOString(), brigade.id]);
});
test('consulta do painel é autenticada, não oferece escrita e não modifica o histórico', async () => {
  const unauthenticated = await fetch(base + '/api/operacao/monitoramento');
  assert.equal(unauthenticated.status, 401);
  const before = await query('SELECT * FROM acessos_mina ORDER BY id');
  const response = await fetch(base + '/api/operacao/monitoramento', { headers: { Authorization: 'Bearer ' + token } });
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const write = await fetch(base + '/api/operacao/monitoramento', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  assert.equal(write.status, 404);
  assert.deepEqual(await query('SELECT * FROM acessos_mina ORDER BY id'), before);
});
test('entrada e saída tradicionais atualizam o painel sem alterar a regra operacional de acesso', async () => {
  const training = (await query("INSERT INTO treinamentos (nome) VALUES ('Requisito de acesso do teste')"))[0].id;
  await saveTraining(null, { colaborador_id: outside.id, treinamento_id: training, realizacao: today(), sem_vencimento: true }, user);
  await mineAccess({ colaborador_id: outside.id, tipo: 'ENTRADA' }, user);
  assert.equal((await monitoringOverview()).brigadistas.na_mina, 2);
  await mineAccess({ colaborador_id: outside.id, tipo: 'SAIDA' }, user);
  assert.equal((await monitoringOverview()).brigadistas.na_mina, 1);
  assert.ok((await queryOne('SELECT saida FROM acessos_mina WHERE colaborador_id=?', [outside.id])).saida);
});
test('migração é repetível e não altera as fotos ou registros de acesso existentes', async () => {
  const before = await query('SELECT * FROM acessos_mina ORDER BY id');
  await runMigrations(); await runMigrations();
  assert.deepEqual(await query('SELECT * FROM acessos_mina ORDER BY id'), before);
  assert.equal((await collaborators.buscarPorId(brigade.id)).brigadista, 1);
});

test('perfil usa o identificador, separa presença e histórico e exige autenticação sem gravar dados', async () => {
  const before = await query('SELECT * FROM acessos_mina ORDER BY id');
  const url = base + '/api/operacao/monitoramento/perfil/' + brigade.id;
  assert.equal((await fetch(url)).status, 401);
  const headers = { Authorization: 'Bearer ' + token };
  const response = await fetch(url, { headers });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const profile = await response.json();
  assert.equal(profile.colaborador.id, brigade.id);
  assert.equal(profile.colaborador.matricula, brigade.matricula);
  assert.equal(profile.colaborador.brigadista, true);
  assert.ok(profile.acesso_ativo);
  assert.equal(profile.historico.length, 1);
  assert.equal(profile.historico[0].em_aberto, true);
  assert.equal(profile.historico[0].operador_entrada, 'Monitor');
  assert.equal(profile.colaborador.nfc_id, undefined);
  const absent = await (await fetch(base + '/api/operacao/monitoramento/perfil/' + outside.id, { headers })).json();
  assert.equal(absent.acesso_ativo, null);
  assert.equal(absent.historico[0].em_aberto, false);
  assert.ok(absent.historico[0].saida);
  assert.equal((await fetch(base + '/api/operacao/monitoramento/perfil/99999999', { headers })).status, 404);
  assert.equal((await fetch(base + '/api/operacao/monitoramento/perfil/-1001', { headers })).status, 400);
  assert.deepEqual(await query('SELECT * FROM acessos_mina ORDER BY id'), before);
});
