const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-returns-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'returns.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { EmprestimoService: loans } = require('../dist/services/EmprestimoService');
const { MaterialService: materials } = require('../dist/services/MaterialService');
const { quantityMove } = require('../dist/services/QuantityService');
const { quickReturn, pendingReturns } = require('../dist/services/ReturnService');
const { app } = require('../dist/server');
let operator, reader, server, base, sequence = 0;
const key = () => crypto.randomUUID();
before(async () => {
  await runMigrations();
  for (const role of ['OPERADOR', 'CONSULTA']) {
    const user = (await query('INSERT INTO usuarios (nome, matricula, nivel_acesso, senha_hash) VALUES (?, ?, ?, ?)',
      [role, role, role, 'unused']))[0];
    const actor = { id: user.id, token: jwt.sign({ id: user.id }, process.env.JWT_SECRET) };
    if (role === 'OPERADOR') operator = actor; else reader = actor;
  }
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
async function fixture() {
  const prefix = 'RETURN-' + ++sequence;
  const person = (await query('INSERT INTO colaboradores (nome, matricula, setor, nfc_id) VALUES (?, ?, ?, ?)',
    ['Pessoa ' + prefix, prefix, 'Subsolo', 'NFC-' + prefix]))[0].id;
  const individual = [];
  for (let i = 0; i < 2; i++) individual.push(await materials.criar({ nome: 'Lanterna ' + prefix, codigo_interno: prefix + '-' + i, codigo_barras: 'BAR-' + prefix + '-' + i }));
  await loans.realizarSaida({ colaboradorId: person, operadorId: operator.id,
    materiaisCodigos: individual.map(item => item.codigo_interno), requestId: key() });
  const bulk = await materials.criar({ nome: 'Luvas ' + prefix, codigo_interno: prefix + '-Q', codigo_barras: 'BAR-' + prefix + '-Q' });
  await query("UPDATE materiais SET tipo_controle = 'QUANTIDADE', saldo_disponivel = 20 WHERE id = ?", [bulk.id]);
  await quantityMove({ tipo: 'RETIRADA', material_id: bulk.id, colaborador_id: person, quantidade: 8, requestId: key() }, operator.id);
  const pending = (await pendingReturns({ busca: prefix })).items[0];
  const payload = { colaboradorId: person, condicao: 'APTO', nfcId: 'NFC-' + prefix, requestId: key(), itens: pending.materiais.map(item =>
    ({ tipo: item.tipo, emprestimoId: item.emprestimo_id, quantidade: item.quantidade, codigoBarras: item.codigo_barras })) };
  return { person, prefix, individual, bulk, pending, payload };
}
const snapshot = async () => Promise.all(['emprestimos', 'movimentacoes', 'auditoria', 'requisicoes'].map(async table =>
  (await queryOne('SELECT COUNT(*) AS n FROM ' + table)).n));

test('lista une equipamentos e quantidades, encontra material sem esconder outros itens e inclui inativos', async () => {
  const f = await fixture();
  await query("UPDATE colaboradores SET status = 'INATIVO' WHERE id = ?", [f.person]);
  const result = await pendingReturns({ busca: f.bulk.codigo_interno });
  assert.equal(result.total, 1);
  assert.deepEqual(result.resumo, { pessoas: 1, itens: 3, unidades: 10 });
  assert.equal(result.items[0].status, 'INATIVO');
  assert.equal(result.items[0].materiais.length, 3);
  assert.deepEqual((await pendingReturns({ busca: 'NAO-EXISTE' })).resumo, { pessoas: 0, itens: 0, unidades: 0 });
});
test('paginação preserva totais e todos os itens de cada pessoa', async () => {
  const f = await fixture();
  const all = await pendingReturns({ busca: 'RETURN-', limit: 1, page: 1 });
  const next = await pendingReturns({ busca: 'RETURN-', limit: 1, page: 2 });
  assert.equal(all.total, 2); assert.equal(next.total, 2);
  assert.notEqual(all.items[0].id, next.items[0].id);
  assert.equal(next.items[0].materiais.length, 3);
  assert.ok([all.items[0].id, next.items[0].id].includes(f.person));
});
test('baixa parcial mantém pessoa e saldo pendente; baixa completa encerra a lista sem duplicar estoque', async () => {
  const f = await fixture(), partial = structuredClone(f.payload);
  partial.itens = [partial.itens.find(item => item.tipo === 'INDIVIDUAL'),
    { ...partial.itens.find(item => item.tipo === 'QUANTIDADE'), quantidade: 3 }];
  const result = await quickReturn(partial, operator.id);
  assert.equal(result.unidadesCount, 4);
  const remaining = (await pendingReturns({ busca: f.prefix })).items[0];
  assert.equal(remaining.total_unidades, 6); assert.equal(remaining.total_itens, 2);
  assert.equal((await materials.buscarPorId(f.bulk.id)).saldo_disponivel, 15);
  const complete = { ...f.payload, requestId: key(), itens: remaining.materiais.map(item =>
    ({ tipo: item.tipo, emprestimoId: item.emprestimo_id, quantidade: item.quantidade, codigoBarras: item.codigo_barras })) };
  await quickReturn(complete, operator.id);
  assert.equal((await pendingReturns({ busca: f.prefix })).total, 0);
  assert.equal((await materials.buscarPorId(f.bulk.id)).saldo_disponivel, 20);
  const before = await snapshot();
  assert.deepEqual(await quickReturn(partial, operator.id), result);
  assert.deepEqual(await snapshot(), before);
});
test('devoluções tradicionais removem pendências das duas modalidades', async () => {
  const f = await fixture();
  await loans.realizarEntrada({ colaboradorId: f.person, operadorId: operator.id,
    materiaisCodigos: f.individual.map(item => item.codigo_interno), requestId: key() });
  const bulk = f.payload.itens.find(item => item.tipo === 'QUANTIDADE');
  await quantityMove({ tipo: 'DEVOLUCAO', emprestimo_id: bulk.emprestimoId, quantidade: 8, condicao: 'APTO', requestId: key() }, operator.id);
  assert.equal((await pendingReturns({ busca: f.prefix })).total, 0);
});
test('conferência e manutenção são aplicadas a equipamentos e saldos quantitativos', async () => {
  for (const [condition, status, column] of [['CONFERENCIA', 'AGUARDANDO_CONFERENCIA', 'saldo_conferencia'], ['DANIFICADO', 'MANUTENCAO', 'saldo_manutencao']]) {
    const f = await fixture();
    await quickReturn({ ...f.payload, condicao: condition }, operator.id);
    for (const item of f.individual) assert.equal((await materials.buscarPorId(item.id)).status, status);
    assert.equal((await materials.buscarPorId(f.bulk.id))[column], 8);
    assert.equal((await materials.buscarPorId(f.bulk.id)).saldo_disponivel, 12);
  }
});
test('falha na quantidade reverte também equipamentos, histórico e auditoria do lote', async () => {
  const f = await fixture(), before = await snapshot();
  await query("UPDATE materiais SET tipo_controle = 'INDIVIDUAL' WHERE id = ?", [f.bulk.id]);
  await assert.rejects(quickReturn(f.payload, operator.id), /quantidade não encontrado/);
  assert.deepEqual(await snapshot(), before);
  for (const item of f.individual) assert.equal((await materials.buscarPorId(item.id)).status, 'EM_USO');
});
test('lista antiga não pode devolver uma nova retirada do mesmo material', async () => {
  const f = await fixture(), old = f.payload.itens.find(item => item.tipo === 'INDIVIDUAL');
  const material = f.pending.materiais.find(item => item.emprestimo_id === old.emprestimoId && item.tipo === old.tipo);
  await loans.realizarEntrada({ colaboradorId: f.person, operadorId: operator.id, materiaisCodigos: [material.codigo_interno], requestId: key() });
  await loans.realizarSaida({ colaboradorId: f.person, operadorId: operator.id, materiaisCodigos: [material.codigo_interno], requestId: key() });
  await assert.rejects(quickReturn({ ...f.payload, itens: [old] }, operator.id), /já foi devolvido/);
  assert.equal((await materials.buscarPorId(material.material_id)).status, 'EM_USO');
});
test('devoluções simultâneas têm apenas uma confirmação e preservam saldo', async () => {
  const f = await fixture();
  const results = await Promise.allSettled([quickReturn(f.payload, operator.id), quickReturn({ ...f.payload, requestId: key() }, operator.id)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await materials.buscarPorId(f.bulk.id)).saldo_disponivel, 20);
});
test('API exige perfil operacional e rejeita duplicatas, empréstimo alheio e chave reutilizada', async () => {
  const f = await fixture();
  const response = await fetch(base + '/api/emprestimos/entrada-rapida', { method: 'POST',
    headers: { Authorization: 'Bearer ' + reader.token, 'Content-Type': 'application/json' }, body: JSON.stringify(f.payload) });
  assert.equal(response.status, 403);
  await assert.rejects(quickReturn({ ...f.payload, itens: [f.payload.itens[0], f.payload.itens[0]] }, operator.id), /repetidos/);
  const other = await fixture();
  await assert.rejects(quickReturn({ ...f.payload, colaboradorId: other.person }, operator.id), /crachá|responsável/);
  await quickReturn(f.payload, operator.id);
  await assert.rejects(quickReturn({ ...other.payload, requestId: f.payload.requestId }, operator.id), /outra operação/);
});

async function post(route, data) {
  const response = await fetch(base + '/api/' + route, { method: 'POST', headers: {
    Authorization: 'Bearer ' + operator.token, 'Content-Type': 'application/json'
  }, body: JSON.stringify(data) });
  return { status: response.status, data: await response.json() };
}

test('API tradicional exige NFC correto e código de barras real, preservando repetição idempotente', async () => {
  const f = await fixture();
  const data = { colaboradorId: f.person, materiaisCodigos: [f.individual[0].codigo_barras], requestId: key(), nfcId: f.payload.nfcId };
  const before = await snapshot();
  for (const invalid of [{ ...data, nfcId: undefined }, { ...data, nfcId: f.prefix },
    { ...data, nfcId: 'NFC-OUTRO' }, { ...data, materiaisCodigos: [f.individual[0].codigo_interno] },
    { ...data, materiaisCodigos: [] }]) {
    assert.equal((await post('emprestimos/entrada', invalid)).status, 400);
    assert.deepEqual(await snapshot(), before);
  }
  const valid = await post('emprestimos/entrada', data);
  assert.equal(valid.status, 200);
  assert.equal((await materials.buscarPorId(f.individual[0].id)).status, 'DISPONIVEL');
  const after = await snapshot();
  assert.deepEqual(await post('emprestimos/entrada', data), valid);
  assert.deepEqual(await snapshot(), after);
});

test('API por quantidade exige crachá e etiqueta do material antes de devolver', async () => {
  const f = await fixture(), loan = f.payload.itens.find(item => item.tipo === 'QUANTIDADE');
  const data = { tipo: 'DEVOLUCAO', emprestimo_id: loan.emprestimoId, quantidade: 2, condicao: 'APTO',
    requestId: key(), nfcId: f.payload.nfcId, codigoBarras: f.bulk.codigo_barras };
  const before = await snapshot();
  for (const invalid of [{ ...data, nfcId: undefined }, { ...data, codigoBarras: undefined },
    { ...data, nfcId: f.prefix }, { ...data, codigoBarras: f.bulk.codigo_interno },
    { ...data, codigoBarras: f.individual[0].codigo_barras }]) {
    assert.equal((await post('quantidades/movimentar', invalid)).status, 400);
    assert.deepEqual(await snapshot(), before);
    assert.equal((await materials.buscarPorId(f.bulk.id)).saldo_disponivel, 12);
  }
  const valid = await post('quantidades/movimentar', data);
  assert.equal(valid.status, 200);
  assert.deepEqual(await post('quantidades/movimentar', data), valid);
  assert.equal((await materials.buscarPorId(f.bulk.id)).saldo_disponivel, 14);
});

test('baixa rápida exige leitura de cada código e NFC antes de qualquer alteração', async () => {
  const f = await fixture(), before = await snapshot();
  for (const data of [{ ...f.payload, nfcId: undefined }, { ...f.payload, nfcId: f.prefix },
    { ...f.payload, itens: f.payload.itens.map((item, index) => index ? item : { ...item, codigoBarras: undefined }) },
    { ...f.payload, itens: f.payload.itens.map(item => ({ ...item, codigoBarras: 'ETIQUETA-ERRADA' })) }]) {
    assert.equal((await post('emprestimos/entrada-rapida', data)).status, 400);
    assert.deepEqual(await snapshot(), before);
  }
  assert.equal((await post('emprestimos/entrada-rapida', f.payload)).status, 200);
  assert.equal((await pendingReturns({ busca: f.prefix })).total, 0);
});
