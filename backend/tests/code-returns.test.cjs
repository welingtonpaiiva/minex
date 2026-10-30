const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const jwt=require('jsonwebtoken');
process.env.DB_CLIENT='sqlite';
process.env.SQLITE_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'minex-code-returns-')),'test.db');
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');
delete process.env.MYSQL_HOST;delete process.env.INITIAL_ADMIN_PASSWORD;
const {query,queryOne,closeDatabase}=require('../dist/config/db');
const {runMigrations}=require('../dist/database/migrate');
const {MaterialService}=require('../dist/services/MaterialService');
const {EmprestimoService}=require('../dist/services/EmprestimoService');
const {quantityMove}=require('../dist/services/QuantityService');
const {codeReturnPreview,returnByCode}=require('../dist/services/CodeReturnService');
const {app}=require('../dist/server');
let operator,reader,person,other,server,base,sequence=0;
const key=()=>crypto.randomUUID();
before(async()=>{
  await runMigrations();
  for(const role of ['OPERADOR','CONSULTA']){
    const row=(await query('INSERT INTO usuarios (nome,matricula,nivel_acesso,senha_hash) VALUES (?,?,?,?)',[role,role,role,'unused']))[0];
    const actor={id:row.id,token:jwt.sign({id:row.id},process.env.JWT_SECRET)};
    if(role==='OPERADOR')operator=actor;else reader=actor;
  }
  person=(await query("INSERT INTO colaboradores (nome,matricula) VALUES ('Pessoa sem NFC','PERSON-1')"))[0].id;
  other=(await query("INSERT INTO colaboradores (nome,matricula,nfc_id) VALUES ('Outra pessoa','PERSON-2','NFC-2')"))[0].id;
  server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port+'/api/emprestimos';
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await closeDatabase();});
async function fixture(quantitative=false){
  const tag='CODE-'+ ++sequence;
  const material=await MaterialService.criar({nome:'Material '+tag,codigo_interno:tag,codigo_barras:'BAR-'+tag});
  if(quantitative){
    await query("UPDATE materiais SET tipo_controle='QUANTIDADE',saldo_disponivel=20 WHERE id=?",[material.id]);
    for(const collaborator of [person,other])await quantityMove({tipo:'RETIRADA',material_id:material.id,colaborador_id:collaborator,quantidade:5,requestId:key()},operator.id);
  }else await EmprestimoService.realizarSaida({colaboradorId:person,operadorId:operator.id,materiaisCodigos:[tag],requestId:key()});
  const preview=await codeReturnPreview(tag),loan=preview.emprestimos[0];
  const payload={codigo:tag,acao:'DEVOLUCAO',emprestimoId:loan.id,versao:loan.versao,quantidade:1,condicao:'APTO',confirmar:true,requestId:key()};
  return {material,preview,loan,payload};
}
const snapshot=async()=>Promise.all(['emprestimos','emprestimos_quantidade','movimentacoes','auditoria','requisicoes'].map(async table=>(await queryOne('SELECT COUNT(*) AS n FROM '+table)).n));

test('consulta por TAG identifica responsável sem NFC e não altera o estoque',async()=>{
  const f=await fixture(),before=await snapshot();
  assert.equal((await codeReturnPreview(f.material.codigo_barras)).material.id,f.material.id);
  const barcode=await codeReturnPreview(f.material.codigo_interno);
  assert.equal(barcode.material.id,f.material.id);assert.equal(barcode.emprestimos[0].colaborador.id,person);
  assert.equal(barcode.emprestimos[0].versao,f.loan.versao);
  assert.deepEqual(await snapshot(),before);
  const response=await fetch(base+'/entrada-por-codigo',{method:'POST',headers:{Authorization:'Bearer '+operator.token,'Content-Type':'application/json'},body:JSON.stringify(f.payload)});
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.colaborador.id,person);
  assert.equal((await MaterialService.buscarPorId(f.material.id)).status,'DISPONIVEL');
  assert.equal((await codeReturnPreview(f.payload.codigo)).emprestimos.length,0);
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_id=? AND tipo='ENTRADA'",[f.material.id])).n,1);
  const audit=await queryOne("SELECT * FROM auditoria WHERE acao='DEVOLUCAO_POR_CODIGO' AND referencia_id=?",[f.material.id]);
  assert.equal(audit.usuario_id,operator.id);assert.equal(JSON.parse(audit.detalhes).identificacao,'TAG_OU_CODIGO_BARRAS');
});

test('perfil, confirmação, código incorreto e empréstimo de outro item são bloqueados',async()=>{
  const f=await fixture(),g=await fixture(),before=await snapshot();
  for(const [method,route,body]of [['GET','/entrada-por-codigo/'+f.payload.codigo],['POST','/entrada-por-codigo',f.payload]]){
    const response=await fetch(base+route,{method,headers:{Authorization:'Bearer '+reader.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});assert.equal(response.status,403);
  }
  await assert.rejects(returnByCode({...f.payload,confirmar:false},operator.id),/confirme/);
  await assert.rejects(returnByCode({...f.payload,codigo:'INEXISTENTE'},operator.id),/não cadastrado/);
  await assert.rejects(returnByCode({...f.payload,emprestimoId:g.loan.id},operator.id),/retirada mudou/);
  await assert.rejects(returnByCode({...f.payload,quantidade:2},operator.id),/Quantidade/);
  assert.deepEqual(await snapshot(),before);
});

test('repetição é idempotente e uma prévia antiga não devolve uma nova retirada',async()=>{
  const f=await fixture();const result=await returnByCode(f.payload,operator.id),before=await snapshot();
  assert.deepEqual(await returnByCode(f.payload,operator.id),result);assert.deepEqual(await snapshot(),before);
  await assert.rejects(returnByCode({...f.payload,condicao:'CONFERENCIA'},operator.id),/Identificador/);
  await EmprestimoService.realizarSaida({colaboradorId:other,operadorId:operator.id,materiaisCodigos:[f.payload.codigo],requestId:key()});
  await assert.rejects(returnByCode({...f.payload,requestId:key()},operator.id),/retirada mudou/);
  assert.equal((await MaterialService.buscarPorId(f.material.id)).status,'EM_USO');
});

test('devoluções concorrentes confirmam apenas uma baixa',async()=>{
  const f=await fixture();
  const results=await Promise.allSettled([returnByCode(f.payload,operator.id),returnByCode({...f.payload,requestId:key()},operator.id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_id=? AND tipo='ENTRADA'",[f.material.id])).n,1);
});

test('falha de auditoria reverte estoque, empréstimo, histórico e idempotência',async()=>{
  const f=await fixture(),before=await snapshot();
  await query("CREATE TRIGGER fail_code_return BEFORE INSERT ON auditoria WHEN NEW.acao='DEVOLUCAO_POR_CODIGO' BEGIN SELECT RAISE(ABORT,'falha de auditoria'); END");
  await assert.rejects(returnByCode(f.payload,operator.id),/falha de auditoria/);
  assert.deepEqual(await snapshot(),before);
  assert.equal((await MaterialService.buscarPorId(f.material.id)).status,'EM_USO');
  await query('DROP TRIGGER fail_code_return');
  await returnByCode(f.payload,operator.id);
  assert.equal((await MaterialService.buscarPorId(f.material.id)).status,'DISPONIVEL');
});

test('conferência por código libera material já devolvido sem registrar uma segunda entrada',async()=>{
  const f=await fixture();await returnByCode({...f.payload,condicao:'CONFERENCIA'},operator.id);
  const preview=await codeReturnPreview(f.payload.codigo);assert.equal(preview.emprestimos.length,0);assert.equal(preview.conferencia.quantidade,1);
  const payload={codigo:f.payload.codigo,acao:'CONFERENCIA',quantidade:1,condicao:'APTO',versao:preview.conferencia.versao,confirmar:true,requestId:key(),justificativa:'Conferido e apto'};
  await assert.rejects(returnByCode({...payload,justificativa:''},operator.id),/Justificativa/);
  await returnByCode(payload,operator.id);
  assert.equal((await MaterialService.buscarPorId(f.material.id)).status,'DISPONIVEL');
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_id=? AND tipo='ENTRADA'",[f.material.id])).n,1);
  await assert.rejects(returnByCode({...payload,requestId:key()},operator.id),/situação.*mudou/);
});

test('quantidades permitem escolher responsável, devolver parcialmente e liberar conferência',async()=>{
  const f=await fixture(true);assert.equal(f.preview.emprestimos.length,2);
  await returnByCode({...f.payload,quantidade:2,condicao:'CONFERENCIA'},operator.id);
  await assert.rejects(returnByCode({...f.payload,requestId:key()},operator.id),/retirada mudou/);
  let preview=await codeReturnPreview(f.payload.codigo);
  assert.equal(preview.emprestimos.find(i=>i.id===f.loan.id).quantidade,3);
  assert.equal(preview.emprestimos.find(i=>i.id!==f.loan.id).quantidade,5);
  await returnByCode({codigo:f.material.codigo_interno,acao:'CONFERENCIA',quantidade:2,condicao:'APTO',versao:preview.conferencia.versao,
    confirmar:true,requestId:key(),justificativa:'Unidades conferidas'},operator.id);
  const material=await MaterialService.buscarPorId(f.material.id);assert.equal(material.saldo_disponivel,12);assert.equal(material.saldo_conferencia,0);
  const loan=preview.emprestimos.find(i=>i.id===f.loan.id);
  await returnByCode({...f.payload,versao:loan.versao,quantidade:3,requestId:key()},operator.id);
  preview=await codeReturnPreview(f.payload.codigo);assert.equal(preview.emprestimos.length,1);assert.equal(preview.emprestimos[0].colaborador.id,other);
});
