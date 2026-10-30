const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'minex-catalog-')), 'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;
delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { standardizedCatalog, previewCatalogStandardization, applyCatalogStandardization } = require('../dist/services/CatalogStandardization');
const { MaterialService } = require('../dist/services/MaterialService');
const { EmprestimoService } = require('../dist/services/EmprestimoService');
const { app } = require('../dist/server');
let server, base, person;
const actors = {};
before(async () => {
  await runMigrations();
  for (const role of ['ADMINISTRADOR', 'SUPERVISOR', 'OPERADOR', 'OPERADOR_ESTOQUE', 'CONSULTA', 'CADASTRO']) {
    const row = (await query('INSERT INTO usuarios (nome,matricula,nivel_acesso,senha_hash) VALUES (?,?,?,?)', [role, role, role, 'unused']))[0];
    actors[role] = { id: row.id, token: jwt.sign({id:row.id}, process.env.JWT_SECRET) };
  }
  person = (await query("INSERT INTO colaboradores (nome,matricula,nfc_id) VALUES ('Pessoa','TESTE','NFC-TESTE')"))[0].id;
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = 'http://127.0.0.1:' + server.address().port + '/api';
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); await closeDatabase(); });
async function request(route, role, data, method='PATCH') {
  const response = await fetch(base + route, {method,headers:{Authorization:'Bearer '+actors[role].token,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(data)});
  return {status:response.status,data:await response.json()};
}

test('padronização mantém IDs, empréstimos, situações e histórico; repetição não duplica auditoria', async () => {
  const first = await MaterialService.criar({nome:'Lanterna',codigo_interno:'LM-01',codigo_barras:'LM-001'});
  const second = await MaterialService.criar({nome:'Lanterna',codigo_interno:'LM-02',patrimonio:'ANTIGO'});
  await EmprestimoService.realizarSaida({colaboradorId:person,operadorId:actors.OPERADOR.id,materiaisCodigos:[second.codigo_interno],requestId:crypto.randomUUID()});
  const before = await query('SELECT * FROM materiais ORDER BY id');
  const loans = await query('SELECT * FROM emprestimos'), history = await query('SELECT * FROM movimentacoes');
  const preview = await previewCatalogStandardization();
  assert.equal(preview.total,2); assert.equal(preview.tags,2); assert.equal(preview.codigos_barras,1);
  await applyCatalogStandardization(preview.versao, actors.ADMINISTRADOR.id);
  const after = await query('SELECT * FROM materiais ORDER BY id');
  for (let i=0;i<before.length;i++) {
    const {codigo_interno,codigo_barras,patrimonio,updated_at,...old}=before[i];
    const {codigo_interno:tag,codigo_barras:barcode,patrimonio:asset,updated_at:date,...current}=after[i];
    assert.deepEqual(current,old); assert.equal(tag,barcode); assert.equal(asset,'MINA-UG');
  }
  assert.equal((await MaterialService.buscarPorCodigo('LM-001')).id,first.id);
  assert.equal((await MaterialService.buscarPorCodigo('LM-002')).id,second.id);
  assert.deepEqual(await query('SELECT * FROM emprestimos'),loans);
  assert.deepEqual(await query('SELECT * FROM movimentacoes'),history);
  const count = await queryOne("SELECT COUNT(*) AS n FROM auditoria WHERE acao='PADRONIZAR_CATALOGO'");
  const repeat = await applyCatalogStandardization((await previewCatalogStandardization()).versao, actors.ADMINISTRADOR.id);
  assert.equal(repeat.atualizados,0);
  assert.deepEqual(await queryOne("SELECT COUNT(*) AS n FROM auditoria WHERE acao='PADRONIZAR_CATALOGO'"),count);
});

test('colisões, códigos personalizados e prévias antigas são recusados sem alterar o catálogo', async () => {
  assert.throws(()=>standardizedCatalog([{id:1,codigo_interno:'RP-01',codigo_barras:'RP-01'},{id:2,codigo_interno:'RP-001',codigo_barras:'RP-001'}]),/Conflito/);
  assert.throws(()=>standardizedCatalog([{id:1,codigo_interno:'RP-01',codigo_barras:'CUSTOM'}]),/personalizado/);
  const preview = await previewCatalogStandardization();
  await MaterialService.criar({nome:'Rádio',codigo_interno:'RP-01'});
  const before = await query('SELECT * FROM materiais ORDER BY id');
  await assert.rejects(applyCatalogStandardization(preview.versao,actors.ADMINISTRADOR.id),/nova prévia/);
  assert.deepEqual(await query('SELECT * FROM materiais ORDER BY id'),before);
  await query("CREATE TRIGGER fail_catalog_audit BEFORE INSERT ON auditoria WHEN NEW.acao='PADRONIZAR_CATALOGO' BEGIN SELECT RAISE(ABORT,'falha simulada'); END");
  await assert.rejects(applyCatalogStandardization((await previewCatalogStandardization()).versao,actors.ADMINISTRADOR.id),/falha simulada/);
  assert.deepEqual(await query('SELECT * FROM materiais ORDER BY id'),before);
  await query('DROP TRIGGER fail_catalog_audit');
});

test('operadores conferem itens pendentes com justificativa, sem receber acesso aos ajustes administrativos', async () => {
  let index = 0;
  for (const role of ['OPERADOR','OPERADOR_ESTOQUE','ADMINISTRADOR','SUPERVISOR']) {
    const item = await MaterialService.criar({nome:'Pendente',codigo_interno:'CONF-'+ ++index});
    await query("UPDATE materiais SET status='AGUARDANDO_CONFERENCIA' WHERE id=?",[item.id]);
    const route = '/materiais/'+item.id+'/conferencia';
    assert.equal((await request(route,'CONSULTA',{status:'DISPONIVEL',observacao:'Conferido'})).status,403);
    assert.equal((await request(route,'CADASTRO',{status:'DISPONIVEL',observacao:'Conferido'})).status,403);
    assert.equal((await request(route,role,{status:'DISPONIVEL',observacao:''})).status,400);
    assert.equal((await request(route,role,{status:'INATIVO',observacao:'Inativar'})).status,400);
    assert.equal((await request(route,role,{status:'DISPONIVEL',observacao:'Conferido e apto'})).status,200);
    assert.equal((await MaterialService.buscarPorId(item.id)).status,'DISPONIVEL');
    assert.equal((await request(route,role,{status:'DISPONIVEL',observacao:'Repetido'})).status,400);
  }
  assert.equal((await request('/materiais/1/status','OPERADOR',{status:'BLOQUEADO',observacao:'Teste'})).status,403);
  const inUse = (await queryOne("SELECT id FROM materiais WHERE status='EM_USO'"));
  assert.equal((await request('/materiais/'+inUse.id+'/conferencia','OPERADOR',{status:'DISPONIVEL',observacao:'Teste'})).status,400);
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM auditoria WHERE acao='CONFERENCIA_ESTOQUE'")).n,4);
});

test('operador libera saldo em conferência, mantendo manutenção e ajuste de saldo restritos', async () => {
  const item = await MaterialService.criar({nome:'Luvas',codigo_interno:'LUV-01'});
  await query("UPDATE materiais SET tipo_controle='QUANTIDADE',saldo_disponivel=7,saldo_conferencia=3,saldo_manutencao=2 WHERE id=?",[item.id]);
  const payload={tipo:'LIBERAR',origem:'CONFERENCIA',material_id:item.id,quantidade:2,justificativa:'Conferido e apto'};
  assert.equal((await request('/quantidades/movimentar','OPERADOR',payload,'POST')).status,200);
  const saved=await MaterialService.buscarPorId(item.id);
  assert.equal(saved.saldo_disponivel,9);assert.equal(saved.saldo_conferencia,1);assert.equal(saved.saldo_manutencao,2);
  assert.equal((await request('/quantidades/movimentar','OPERADOR',{...payload,origem:'MANUTENCAO'},'POST')).status,403);
  assert.equal((await request('/quantidades/movimentar','OPERADOR',{...payload,tipo:'AJUSTE'},'POST')).status,403);
  assert.equal((await request('/quantidades/movimentar','CONSULTA',payload,'POST')).status,403);
});
