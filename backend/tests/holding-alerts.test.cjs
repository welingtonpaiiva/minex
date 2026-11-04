const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(fs.mkdtempSync(path.join(os.tmpdir(),'minex-holding-alerts-')),'test.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, closeDatabase } = require('../dist/config/db');
const { runMigrations } = require('../dist/database/migrate');
const { MaterialService } = require('../dist/services/MaterialService');
const { materialHoldingOverview, pendingReturns } = require('../dist/services/ReturnService');
const { app } = require('../dist/server');
const clock = Date.parse('2026-11-04T15:00:00.000Z');
const ago = hours => new Date(clock-hours*3600000).toISOString();
let critical, boundary, bulk, oldLoan, recentLoan, server, base, token;
async function overview(time=clock) { const original=Date.now;Date.now=()=>time;try{return await materialHoldingOverview();}finally{Date.now=original;} }
before(async()=>{
  await runMigrations();
  const actor=(await query('INSERT INTO usuarios (nome,matricula,senha_hash,nivel_acesso) VALUES (?,?,?,?)',['Consulta','HOLD-READER','unused','CONSULTA']))[0].id;
  token=jwt.sign({id:actor},process.env.JWT_SECRET);
  critical=(await query('INSERT INTO colaboradores (nome,matricula) VALUES (?,?)',['Pessoa com itens','HOLD-1']))[0].id;
  boundary=(await query('INSERT INTO colaboradores (nome,matricula) VALUES (?,?)',['Oito horas exatas','HOLD-2']))[0].id;
  for(const [code,person,withdrawal] of [['HOLD-001',critical,'2026-11-04 03:00:00'],['HOLD-002',critical,ago(1)],['HOLD-003',boundary,ago(8)]]){
    const material=await MaterialService.criar({nome:'Equipamento',codigo_interno:code});
    await query("UPDATE materiais SET status='EM_USO' WHERE id=?",[material.id]);
    const loan=(await query('INSERT INTO emprestimos (colaborador_id,material_id,operador_saida_id,data_hora_saida) VALUES (?,?,?,?)',[person,material.id,actor,withdrawal]))[0].id;
    if(code==='HOLD-001')oldLoan=loan;if(code==='HOLD-002')recentLoan=loan;
  }
  const material=await MaterialService.criar({nome:'Luvas',codigo_interno:'HOLD-Q'});
  await query("UPDATE materiais SET tipo_controle='QUANTIDADE' WHERE id=?",[material.id]);
  bulk=(await query('INSERT INTO emprestimos_quantidade (material_id,colaborador_id,quantidade,devolvida,retirada,operador_id) VALUES (?,?,?,?,?,?)',[material.id,critical,6,4,ago(12),actor]))[0].id;
  server=await new Promise(resolve=>{const instance=app.listen(0,'127.0.0.1',()=>resolve(instance));});base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await closeDatabase();});

test('conta desde a retirada mais antiga, une quantidades e não usa acesso à mina',async()=>{
  const result=await overview();assert.equal(result.limite_segundos,28800);assert.equal(result.quantidade,1);assert.equal(result.total,2);
  const person=result.colaboradores.find(p=>p.id===critical);assert.equal(person.segundos_em_posse,12*3600);assert.equal(person.primeira_retirada,ago(12));assert.equal(person.total_itens,3);assert.equal(person.total_unidades,4);assert.equal(person.excedido,true);
  assert.equal(person.materiais.find(m=>m.codigo_interno==='HOLD-001').retirada,'2026-11-04T06:00:00.000Z');
  assert.equal((await query('SELECT COUNT(*) total FROM acessos_mina'))[0].total,0);
  const pending=(await pendingReturns({colaboradorId:critical})).items[0];assert.equal(pending.primeira_retirada,ago(12));assert.ok(pending.materiais.every(item=>item.retirada.endsWith('Z')));
});
test('oito horas exatas não alertam; 08h00m01s passa ao vermelho',async()=>{
  assert.equal((await overview()).colaboradores.find(p=>p.id===boundary).excedido,false);
  assert.equal((await overview(clock+999)).colaboradores.find(p=>p.id===boundary).excedido,false);
  assert.equal((await overview(clock+1000)).colaboradores.find(p=>p.id===boundary).excedido,true);
});
test('consulta exige autenticação e não altera empréstimos, estoque ou histórico',async()=>{
  const tables=['emprestimos','emprestimos_quantidade','materiais','movimentacoes','auditoria'];
  const snapshot=()=>Promise.all(tables.map(table=>query('SELECT * FROM '+table+' ORDER BY id')));const before=await snapshot();
  assert.equal((await fetch(base+'/api/emprestimos/alertas-posse')).status,401);
  const response=await fetch(base+'/api/emprestimos/alertas-posse',{headers:{Authorization:'Bearer '+token}});assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.ok(Array.isArray((await response.json()).colaboradores));assert.deepEqual(await snapshot(),before);
});
test('devolver o item mais antigo recalcula o tempo e a última devolução remove a pessoa',async()=>{
  await query('UPDATE emprestimos_quantidade SET devolvida=quantidade WHERE id=?',[bulk]);
  assert.equal((await overview()).colaboradores.find(p=>p.id===critical).segundos_em_posse,9*3600);
  await query('DELETE FROM emprestimos WHERE id=?',[oldLoan]);
  const person=(await overview()).colaboradores.find(p=>p.id===critical);assert.equal(person.segundos_em_posse,3600);assert.equal(person.excedido,false);
  await query('DELETE FROM emprestimos WHERE id=?',[recentLoan]);assert.ok(!(await overview()).colaboradores.some(p=>p.id===critical));
});
