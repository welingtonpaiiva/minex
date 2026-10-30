const {test,before,after}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const jwt=require('jsonwebtoken');
process.env.DB_CLIENT='sqlite';process.env.SQLITE_PATH=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'minex-barcode-api-')),'test.db');
process.env.JWT_SECRET=crypto.randomBytes(48).toString('hex');delete process.env.MYSQL_HOST;delete process.env.INITIAL_ADMIN_PASSWORD;
const {query,queryOne,closeDatabase}=require('../dist/config/db');
const {runMigrations}=require('../dist/database/migrate');
const {MaterialService}=require('../dist/services/MaterialService');
const {EmprestimoService}=require('../dist/services/EmprestimoService');
const {codeReturnPreview,returnByCode}=require('../dist/services/CodeReturnService');
const {app}=require('../dist/server');
let server,base,operator,reader,person,item,other;
before(async()=>{
 await runMigrations();
 for(const role of ['OPERADOR','CONSULTA']){const row=(await query('INSERT INTO usuarios (nome,matricula,nivel_acesso,senha_hash) VALUES (?,?,?,?)',[role,role,role,'unused']))[0];const actor={id:row.id,token:jwt.sign({id:row.id},process.env.JWT_SECRET)};if(role==='OPERADOR')operator=actor;else reader=actor;}
 person=(await query("INSERT INTO colaboradores (nome,matricula) VALUES ('Pessoa','BAR-PERSON')"))[0].id;
 item=await MaterialService.criar({nome:'Lanterna',codigo_interno:'LM-003'});other=await MaterialService.criar({nome:'Rádio',codigo_interno:'RP-001'});
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});base='http://127.0.0.1:'+server.address().port+'/api/materiais';
});
after(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await closeDatabase();});
async function link(material,code,actor=operator){return fetch(base+'/'+material.id+'/codigo-barras',{method:'PATCH',headers:{Authorization:'Bearer '+actor.token,'Content-Type':'application/json'},body:JSON.stringify({codigo_barras:code})});}
test('vinculação preserva zeros, situação e TAG, audita e bloqueia conflitos e consulta',async()=>{
 const result=await link(item,'000123450001');assert.equal(result.status,200);
 const saved=await result.json();assert.equal(saved.codigo_barras,'000123450001');assert.equal(saved.codigo_interno,'LM-003');assert.equal(saved.status,'DISPONIVEL');
 assert.equal((await MaterialService.buscarPorCodigo('000123450001')).id,item.id);
 assert.equal((await link(other,'000123450001')).status,400);
 assert.equal((await link(other,'LM-003')).status,400);
 assert.equal((await link(other,'NO-ACCESS',reader)).status,403);
 assert.equal((await queryOne("SELECT usuario_id FROM auditoria WHERE acao='VINCULAR_CODIGO_BARRAS' AND referencia_id=?",[item.id])).usuario_id,operator.id);
});
test('leitura do código vinculado identifica retirada e confirma uma única devolução sem alterar o código',async()=>{
 await EmprestimoService.realizarSaida({colaboradorId:person,operadorId:operator.id,materiaisCodigos:['LM-003'],requestId:crypto.randomUUID()});
 const preview=await codeReturnPreview('000123450001'),loan=preview.emprestimos[0];assert.equal(preview.material.id,item.id);assert.equal(loan.colaborador.id,person);
 const data={codigo:'000123450001',acao:'DEVOLUCAO',emprestimoId:loan.id,versao:loan.versao,quantidade:1,condicao:'APTO',confirmar:true,requestId:crypto.randomUUID()};
 const first=await returnByCode(data,operator.id);assert.deepEqual(await returnByCode(data,operator.id),first);
 assert.equal((await MaterialService.buscarPorId(item.id)).status,'DISPONIVEL');
 assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_id=? AND tipo='ENTRADA'",[item.id])).n,1);
});
test('PDF vetorial e folha de teste estão disponíveis apenas para perfis autorizados',async()=>{
 const pdf=await fetch(base+'/etiquetas',{method:'POST',headers:{Authorization:'Bearer '+operator.token,'Content-Type':'application/json'},body:JSON.stringify({ids:[item.id,other.id]})});
 assert.equal(pdf.status,200);const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(!bytes.toString('latin1').includes('/Subtype /Image'));
 const testPdf=await fetch(base+'/etiquetas/teste',{headers:{Authorization:'Bearer '+operator.token}});assert.equal(testPdf.status,200);
 assert.equal((await fetch(base+'/etiquetas/teste',{headers:{Authorization:'Bearer '+reader.token}})).status,403);
});
