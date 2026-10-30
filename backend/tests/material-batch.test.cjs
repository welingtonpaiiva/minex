const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-material-batch-'));
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { MaterialService } = require('../dist/services/MaterialService');
const { previewBatch, createBatch, previewPatrimony, applyPatrimony } = require('../dist/services/MaterialBatchService');
const { app } = require('../dist/server');
const config = { nome: 'Lanterna', prefixo: 'LM-', inicio: 1, fim: 300, digitos: 3, patrimonio: 'MINA-UG' };
let admin, operator, server, base;
before(async () => {
  await runMigrations();
  for (const role of ['ADMINISTRADOR', 'OPERADOR']) {
    const row = (await query('INSERT INTO usuarios (nome, matricula, nivel_acesso, senha_hash) VALUES (?, ?, ?, ?)', [role, role, role, 'unused']))[0];
    const actor = { id: row.id, token: jwt.sign({ id: row.id }, process.env.JWT_SECRET) };
    if (role === 'ADMINISTRADOR') admin = actor; else operator = actor;
  }
  server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port + '/api/materiais';
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
const snapshot = () => query('SELECT * FROM materiais ORDER BY id');

test('prévia gera 300 TAGs únicas e não grava; API exige administrador e confirmação', async () => {
  const before = await snapshot(), preview = await previewBatch(config);
  assert.equal(preview.total, 300); assert.equal(preview.items[0].codigo, 'LM-001');
  assert.equal(preview.items.at(-1).codigo, 'LM-300');
  assert.equal(new Set(preview.items.map(i => i.codigo)).size, 300);
  assert.ok(preview.items.every(i => i.codigo_barras === i.codigo && i.patrimonio === 'MINA-UG'));
  assert.deepEqual(await snapshot(), before);
  for (const route of ['/lote', '/lote/previa', '/patrimonio-mina-ug']) {
    const denied = await fetch(base + route, { method: 'POST', headers: { Authorization: 'Bearer ' + operator.token, 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    assert.equal(denied.status, 403);
  }
  assert.equal((await fetch(base + '/lote/previa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) })).status, 401);
  await assert.rejects(createBatch(config, admin.id), /confirme/);
  for (const invalid of [{ prefixo: 'bad/' }, { inicio: 0 }, { fim: 1001, digitos: 4 }, { digitos: 2 }, { fim: 1.5 }, { categoria_id: 9999 }]) {
    await assert.rejects(previewBatch({ ...config, ...invalid }));
  }
  assert.deepEqual(await snapshot(), before);
});

test('lotes simultâneos criam somente 300 registros e preservam equipamentos em uso e inativos', async () => {
  const active = await MaterialService.criar({ nome: 'Existente', codigo_interno: 'LM-001', codigo_barras: 'BAR-OLD', patrimonio: 'ORIGINAL' });
  await query("UPDATE materiais SET status = 'EM_USO' WHERE id = ?", [active.id]);
  const retired = await MaterialService.criar({ nome: 'Baixada', codigo_interno: 'LM-002' });
  await query("UPDATE materiais SET status = 'INATIVO' WHERE id = ?", [retired.id]);
  const old = await query('SELECT * FROM materiais ORDER BY id');
  const reports = await Promise.all([createBatch({ ...config, confirmar: true }, admin.id), createBatch({ ...config, confirmar: true }, admin.id)]);
  assert.equal(reports.reduce((sum, report) => sum + report.criados, 0), 298);
  assert.equal(reports.reduce((sum, report) => sum + report.erros, 0), 0);
  assert.equal((await snapshot()).length, 300);
  assert.deepEqual(await query('SELECT * FROM materiais WHERE id IN (?,?) ORDER BY id', [active.id, retired.id]), old);
  const before = await snapshot();
  const repeat = await createBatch({ ...config, confirmar: true }, admin.id);
  assert.deepEqual([repeat.criados, repeat.ignorados, repeat.erros], [0, 300, 0]);
  assert.deepEqual(await snapshot(), before);
});

test('concorrência entre TAG e código de barras impede identificação ambígua', async () => {
  const result = await Promise.allSettled([
    MaterialService.criar({ nome: 'A', codigo_interno: 'RACE-A', codigo_barras: 'RACE-B' }),
    MaterialService.criar({ nome: 'B', codigo_interno: 'RACE-B', codigo_barras: 'RACE-C' })
  ]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  const collision = await MaterialService.criar({ nome: 'Conflito cruzado', codigo_interno: 'OTHER', codigo_barras: 'CROSS-001' });
  await query("UPDATE materiais SET status='INATIVO' WHERE id=?", [collision.id]);
  assert.equal((await previewBatch({ ...config, prefixo: 'CROSS-', fim: 1 })).ignorados, 1);
});

test('falha parcial é relatada e repetição recupera somente o item com erro', async () => {
  await query("CREATE TRIGGER fail_batch BEFORE INSERT ON materiais WHEN NEW.codigo_interno = 'FAIL-002' BEGIN SELECT RAISE(ABORT, 'falha simulada'); END");
  const partial = { ...config, prefixo: 'FAIL-', fim: 3, confirmar: true };
  const first = await createBatch(partial, admin.id);
  assert.deepEqual([first.criados, first.ignorados, first.erros], [2, 0, 1]);
  assert.match(first.items[1].erro, /falha simulada/);
  await query('DROP TRIGGER fail_batch');
  const second = await createBatch(partial, admin.id);
  assert.deepEqual([second.criados, second.ignorados, second.erros], [1, 2, 0]);
  const audits = await query("SELECT * FROM auditoria WHERE acao='CADASTRO_LOTE_ITEM' AND detalhes LIKE '%FAIL-%'");
  assert.equal(audits.length, 3);
});

test('patrimônio requer prévia atual, preserva status e códigos e registra valores anteriores', async () => {
  const item = await MaterialService.criar({ nome: 'Luvas', codigo_interno: 'QUANTITY-TEST', patrimonio: 'ANTIGO' });
  await query("UPDATE materiais SET tipo_controle='QUANTIDADE', saldo_disponivel=17 WHERE id=?", [item.id]);
  const preview = await previewPatrimony();
  await assert.rejects(applyPatrimony({ versao: preview.versao }, admin.id), /Confirme/);
  await MaterialService.editar(item.id, { patrimonio: 'MUDOU' });
  await assert.rejects(applyPatrimony({ confirmar: true, versao: preview.versao }, admin.id), /nova prévia/);
  const current = await previewPatrimony(), before = await snapshot();
  const applied = await applyPatrimony({ confirmar: true, versao: current.versao }, admin.id);
  assert.equal(applied.atualizados, current.total);
  const after = await snapshot();
  for (let i = 0; i < before.length; i++) {
    const { patrimonio: oldPatrimony, updated_at: oldDate, ...old } = before[i];
    const { patrimonio, updated_at, ...unchanged } = after[i];
    assert.equal(patrimonio, 'MINA-UG'); assert.deepEqual(unchanged, old);
  }
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM auditoria WHERE acao='PATRIMONIO_MINA_UG'")).n, current.total);
  assert.equal((await previewPatrimony()).total, 0);
});

test('etiquetas restauradas geram PDF A4 com 300 equipamentos',async()=>{
  const {materialLabels}=require('../dist/services/MaterialLabels');const before=await snapshot();
  const pdf=await materialLabels({busca:'LM-'});assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
  assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,22);
  assert.deepEqual(await snapshot(),before);
});
