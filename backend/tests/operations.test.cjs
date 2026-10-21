const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {spawn}=require('node:child_process');
const bcrypt = require('bcryptjs');

const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'minex-integration-'));
const mysqlMode=process.env.MINEX_TEST_MYSQL==='1';
if(mysqlMode&&!/^minex_test_\d+$/.test(process.env.MYSQL_DATABASE||''))throw new Error('Banco de teste MySQL inválido');
if(!mysqlMode)process.env.DB_CLIENT = 'sqlite';
process.env.SQLITE_PATH = path.join(folder, 'integration.db');
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
if(!mysqlMode)delete process.env.MYSQL_HOST; delete process.env.INITIAL_ADMIN_PASSWORD;
const { query, queryOne, closeDatabase, withTransaction } = require('../dist/config/db');
const { runMigrations, mysqlDDL } = require('../dist/database/migrate');
const op = require('../dist/services/OperationalService');
const { EmprestimoService: loans } = require('../dist/services/EmprestimoService');
const { MaterialService: materials } = require('../dist/services/MaterialService');
const { app } = require('../dist/server');
const { quantityMove } = require('../dist/services/QuantityService');
const { now, today } = require('../dist/utils/time');
const password = 'Integration-only-4829!';
let admin, operator, consultation, collaborator, training, server, base, tokens = {};
const key = () => crypto.randomUUID();
const stamp = hours => new Date(Date.now() - hours * 3600000).toISOString();
async function material(code) { return materials.criar({ nome: 'Teste ' + code, codigo_interno: code }); }
async function request(route, method = 'GET', data, token = tokens.admin) {
  const response = await fetch(base + '/api/' + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  return { status: response.status, data: await response.json() };
}
before(async () => {
  await runMigrations();
  const hash = await bcrypt.hash(password, 4);
  for (const [name, role] of [['admin','ADMINISTRADOR'], ['operator','OPERADOR'], ['consultation','CONSULTA']]) {
    const result = await query('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)', [name,name,hash,role,'ATIVO']);
    if(name==='admin')admin=result[0].id;if(name==='operator')operator=result[0].id;if(name==='consultation')consultation=result[0].id;
  }
  collaborator = (await query("INSERT INTO colaboradores (nome, matricula, setor, status) VALUES ('Pessoa de teste','TEST-001','Testes','ATIVO')"))[0].id;
  training = (await query("INSERT INTO treinamentos (nome, descricao) VALUES ('Requisito configurado em teste', '')"))[0].id;
  server = await new Promise(resolve => { const instance=app.listen(0,'127.0.0.1',()=>resolve(instance)); });
  base = 'http://127.0.0.1:' + server.address().port;
  for(const name of ['admin','operator','consultation']) { const result=await request('auth/login','POST',{matricula:name,senha:password},null);assert.equal(result.status,200);tokens[name]=result.data.token; }
});
after(async () => { if(server)await new Promise(resolve=>server.close(resolve));await closeDatabase();console.log('Banco isolado de testes: '+process.env.SQLITE_PATH); });

test('migrations preservam dados, são repetíveis e criam restrições', async () => {
  await runMigrations(); assert.equal((await queryOne('SELECT nome FROM colaboradores WHERE id=?',[collaborator])).nome,'Pessoa de teste');
  assert.equal((await query('SELECT * FROM schema_migrations')).length,5);
  if(!mysqlMode)assert.deepEqual(await query('PRAGMA foreign_key_check'),[]);
});
test('conformidade nunca presume ausência de requisitos como conforme', async () => {
  assert.equal((await op.getCompliance(collaborator)).situacao,'PENDENTE');
  const record={colaborador_id:collaborator,treinamento_id:training,obrigatorio:true,status:'ATIVO',observacao:''};
  await op.saveTraining(null,record,admin);let current=(await op.getCompliance(collaborator)).treinamentos[0];
  assert.equal(op.compliance([current]),'PENDENTE');
  await op.saveTraining(current.id,{...record,realizacao:today(),sem_vencimento:true},admin);
  assert.equal((await op.getCompliance(collaborator)).situacao,'CONFORME');
  assert.equal(op.compliance([{...current,realizacao:'2020-01-01',validade:'2020-01-02'}]),'NAO_CONFORME');
  assert.equal(op.compliance([{...current,em_analise:1}]),'EM_ANALISE');
  assert.equal(op.compliance([{...current,realizacao:today(),validade:today()}]),'CONFORME');
  assert.equal(op.compliance([{...current,realizacao:today(),validade:today(),impeditivo:1}]),'NAO_CONFORME');
  await assert.rejects(op.saveTraining(current.id,{...record,realizacao:'2026-02-30'},admin));
});
test('acesso efetivo, alerta de oito horas, virada de dia e saída independem de materiais', async () => {
  await op.mineAccess({colaborador_id:collaborator,tipo:'ENTRADA'},operator);
  await assert.rejects(op.mineAccess({colaborador_id:collaborator,tipo:'ENTRADA'},operator));
  await query('UPDATE acessos_mina SET entrada=? WHERE ativo_colaborador_id=?',[stamp(9),collaborator]);
  const overview=await op.mineOverview();assert.equal(overview.quantidade,1);assert.ok(overview.colaboradores[0].minutos>=540);
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM emprestimos')).n,0);
  await op.mineAccess({colaborador_id:collaborator,tipo:'SAIDA'},operator);
  assert.equal((await op.mineOverview()).quantidade,0);
  assert.ok((await queryOne('SELECT saida FROM acessos_mina')).saida);
});
test('falha no segundo material reverte retirada, histórico e auditoria do primeiro', async () => {
  const item=await material('ROLLBACK');
  const count=(await queryOne('SELECT COUNT(*) AS n FROM auditoria')).n;
  await assert.rejects(loans.realizarSaida({colaboradorId:collaborator,operadorId:operator,materiaisCodigos:['ROLLBACK','NAO_EXISTE'],requestId:key()}));
  assert.equal((await materials.buscarPorId(item.id)).status,'DISPONIVEL');
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM auditoria')).n,count);
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM emprestimos')).n,0);
});
test('envio repetido é idempotente; a mesma chave não aceita outro conteúdo', async () => {
  await material('IDEMPOTENT');const data={colaboradorId:collaborator,operadorId:operator,materiaisCodigos:['IDEMPOTENT'],requestId:key()};
  const [a,b]=await Promise.all([loans.realizarSaida(data),loans.realizarSaida({...data})]);assert.deepEqual(a,b);
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_codigo='IDEMPOTENT' AND tipo='SAIDA'")).n,1);
  await assert.rejects(loans.realizarSaida({...data,materiaisCodigos:['ROLLBACK']}));
});
test('doze retiradas simultâneas produzem exatamente um empréstimo', async () => {
  const item=await material('CONCURRENT');
  const results=await Promise.allSettled(Array.from({length:12},(_,i)=>loans.realizarSaida({colaboradorId:collaborator,operadorId:i%2?admin:operator,materiaisCodigos:['CONCURRENT'],requestId:key()})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM emprestimos WHERE material_id=?',[item.id])).n,1);
  assert.equal((await materials.buscarPorId(item.id)).status,'EM_USO');
});
test('devoluções simultâneas não duplicam o retorno e a conferência bloqueia retirada', async () => {
  const results=await Promise.allSettled([operator,admin].map(operadorId=>loans.realizarEntrada({colaboradorId:collaborator,operadorId,materiaisCodigos:['CONCURRENT'],requestId:key(),condicao:'CONFERENCIA'})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const item=await materials.buscarPorCodigo('CONCURRENT');assert.equal(item.status,'AGUARDANDO_CONFERENCIA');
  await assert.rejects(loans.realizarSaida({colaboradorId:collaborator,operadorId:operator,materiaisCodigos:['CONCURRENT'],requestId:key()}));
  await materials.alterarStatus(item.id,'DISPONIVEL','Conferido e apto',admin);
  assert.equal((await materials.buscarPorId(item.id)).status,'DISPONIVEL');
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM movimentacoes WHERE material_codigo='CONCURRENT' AND tipo='ENTRADA'")).n,1);
});
test('devolução parcial mantém outros itens em uso; danificado fica indisponível', async () => {
  await material('PARTIAL-A');await material('PARTIAL-B');
  await loans.realizarSaida({colaboradorId:collaborator,operadorId:operator,materiaisCodigos:['PARTIAL-A','PARTIAL-B'],requestId:key()});
  await loans.realizarEntrada({colaboradorId:collaborator,operadorId:operator,materiaisCodigos:['PARTIAL-A'],requestId:key(),condicao:'DANIFICADO'});
  assert.equal((await materials.buscarPorCodigo('PARTIAL-A')).status,'MANUTENCAO');
  assert.equal((await materials.buscarPorCodigo('PARTIAL-B')).status,'EM_USO');
  await assert.rejects(materials.alterarStatus((await materials.buscarPorCodigo('PARTIAL-B')).id,'DISPONIVEL','Tentativa indevida',admin));
});
test('pendência de 24h não declara perda; ocorrências e devolução preservam histórico', async () => {
  await query("UPDATE emprestimos SET data_hora_saida=? WHERE material_id=(SELECT id FROM materiais WHERE codigo_interno='PARTIAL-B')",[stamp(25)]);
  const listing=await op.listLosses({atrasados:'true'});const item=listing.items.find(i=>i.codigo_interno==='PARTIAL-B');
  assert.equal(item.situacao,'DEVOLUCAO_ATRASADA');assert.equal(item.id,null);
  await op.updateLoss(item.emprestimo_id,{situacao:'EXTRAVIO_EM_APURACAO',descricao:'Investigar retorno'},operator);
  await op.updateLoss(item.emprestimo_id,{situacao:'LOCALIZADO',descricao:'Localizado no balcão'},operator);
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM extravios')).n,1);
  await loans.realizarEntrada({colaboradorId:collaborator,operadorId:operator,materiaisCodigos:['PARTIAL-B'],requestId:key()});
  assert.equal((await queryOne('SELECT situacao FROM extravios')).situacao,'DEVOLVIDO');
  assert.equal((await queryOne("SELECT COUNT(*) AS n FROM auditoria WHERE entidade='extravio'")).n,3);
});
test('API aplica permissões, revoga conta inativa e não expõe fotos sem autenticação', async () => {
  assert.equal((await request('operacao/acessos','POST',{tipo:'ENTRADA',colaborador_id:collaborator},tokens.consultation)).status,403);
  assert.equal((await request('colaboradores','POST',{nome:'Invasão',matricula:'DENIED'},tokens.operator)).status,403);
  assert.equal((await request('operacao/conformidade')).status,200);
  assert.equal((await request('auth/usuarios','POST',{nome:'Inválido',matricula:'BAD',senha:'curta',nivel_acesso:'ROOT'})).status,400);
  assert.equal((await request('fotos/'+crypto.randomUUID()+'.jpg','GET',undefined,null)).status,401);
  assert.equal((await request('fotos/'+collaborator,'POST',{imagem:'data:image/jpeg;base64,AAAA'})).status,400);
  await query("UPDATE usuarios SET status='INATIVO' WHERE id=?",[consultation]);
  assert.equal((await request('auth/me','GET',undefined,tokens.consultation)).status,401);
});
test('DDL MySQL emite InnoDB, autoincremento e chaves estrangeiras reais', () => {
  const ddl=mysqlDDL('CREATE TABLE IF NOT EXISTS exemplo (id INTEGER PRIMARY KEY AUTOINCREMENT,\n colaborador_id INTEGER NOT NULL REFERENCES colaboradores(id),\n created_at TEXT NOT NULL DEFAULT (datetime(\'now\', \'localtime\')))');
  assert.match(ddl,/AUTO_INCREMENT/);assert.match(ddl,/FOREIGN KEY \(colaborador_id\)/);assert.match(ddl,/DATETIME\(3\)/);assert.match(ddl,/ENGINE=InnoDB/);
});

test('saldo quantitativo resiste a concorrência, devoluções parciais, conferência e idempotência', async () => {
  const item=await material('BULK');
  await query("UPDATE materiais SET tipo_controle='QUANTIDADE',saldo_disponivel=10 WHERE id=?",[item.id]);
  const payload={tipo:'RETIRADA',material_id:item.id,colaborador_id:collaborator,quantidade:7,requestId:key()};
  const results=await Promise.allSettled([quantityMove(payload,operator),quantityMove({...payload,requestId:key()},admin)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal((await materials.buscarPorId(item.id)).saldo_disponivel,3);
  const loan=await queryOne('SELECT * FROM emprestimos_quantidade WHERE material_id=?',[item.id]);
  const returning={tipo:'DEVOLUCAO',emprestimo_id:loan.id,quantidade:3,condicao:'CONFERENCIA',requestId:key()};
  const actor=results[0].status==='fulfilled'?operator:admin;
  await quantityMove(returning,actor);await quantityMove(returning,actor);
  const state=await materials.buscarPorId(item.id);assert.equal(state.saldo_disponivel,3);assert.equal(state.saldo_conferencia,3);
  assert.equal((await queryOne('SELECT devolvida FROM emprestimos_quantidade WHERE id=?',[loan.id])).devolvida,3);
  await assert.rejects(quantityMove({...returning,quantidade:5,requestId:key()},actor));
  await quantityMove({tipo:'LIBERAR',material_id:item.id,quantidade:3,origem:'CONFERENCIA',justificativa:'Conferência aprovada',requestId:key()},admin);
  assert.equal((await materials.buscarPorId(item.id)).saldo_disponivel,6);
  await assert.rejects(quantityMove({tipo:'AJUSTE',material_id:item.id,quantidade:-7,justificativa:'Não pode ficar negativo',requestId:key()},admin));
  await query('UPDATE emprestimos_quantidade SET retirada=? WHERE id=?',[stamp(25),loan.id]);
  const incident=(await op.listLosses({atrasados:'true'})).items.find(i=>i.emprestimo_id===-loan.id);
  assert.equal(incident.quantidade,4);
  await op.updateLoss(-loan.id,{situacao:'EXTRAVIO_EM_APURACAO',descricao:'Verificar quatro unidades'},operator);
  await quantityMove({tipo:'DEVOLUCAO',emprestimo_id:loan.id,quantidade:4,condicao:'APTO',requestId:key()},actor);
  assert.equal((await materials.buscarPorId(item.id)).saldo_disponivel,10);
  assert.equal((await queryOne('SELECT situacao FROM extravios WHERE emprestimo_origem_id=?',[-loan.id])).situacao,'DEVOLVIDO');
});

test('processos Node independentes disputam a mesma unidade sem duplicação', async()=>{
  const item=await material('CROSS-PROCESS');
  const results=await Promise.all([operator,admin,operator,admin].map(operadorId=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.join(__dirname,'loan-worker.cjs'),JSON.stringify({colaboradorId:collaborator,operadorId,materiaisCodigos:['CROSS-PROCESS'],requestId:key()})],{env:process.env});
    let output='',errors='';child.stdout.on('data',chunk=>output+=chunk);child.stderr.on('data',chunk=>errors+=chunk);child.on('error',reject);child.on('exit',code=>{if(code)return reject(new Error(errors));try{resolve(JSON.parse(output.trim()));}catch(e){reject(new Error(output+errors));}});
  })));
  assert.equal(results.filter(r=>r.ok).length,1);
  assert.equal((await queryOne('SELECT COUNT(*) AS n FROM emprestimos WHERE material_id=?',[item.id])).n,1);
});
test('fotografia é decodificada, redimensionada e vinculada ao cadastro autenticado',async()=>{
  const sharp=require('sharp');
  const image=await sharp({create:{width:1000,height:800,channels:3,background:{r:30,g:80,b:120}}}).jpeg().toBuffer();
  const result=await request('fotos/'+collaborator,'POST',{imagem:'data:image/jpeg;base64,'+image.toString('base64')});
  assert.equal(result.status,200);assert.match(result.data.foto_url,/^\/api\/fotos\//);
  const metadata=await queryOne('SELECT * FROM fotos WHERE colaborador_id=?',[collaborator]);assert.equal(metadata.largura,640);assert.equal(metadata.altura,512);assert.ok(metadata.tamanho<512*1024);
  const stored=await queryOne('SELECT imagem_base64 FROM foto_conteudos WHERE foto_id=?',[metadata.id]);
  const bytes=Buffer.from(stored.imagem_base64,'base64');
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),metadata.sha256);
  assert.equal(fs.existsSync(path.join(__dirname,'../uploads',metadata.arquivo)),false,'Nova foto deve sobreviver sem arquivo local');
  const loaded=await fetch(base+result.data.foto_url,{headers:{Authorization:'Bearer '+tokens.admin}});
  assert.equal(loaded.status,200);assert.equal(loaded.headers.get('content-type'),'image/jpeg');
  assert.deepEqual(Buffer.from(await loaded.arrayBuffer()),bytes);
  const again=await request('fotos/'+collaborator,'POST',{imagem:'data:image/jpeg;base64,'+image.toString('base64')});
  assert.equal(again.status,200);assert.equal((await queryOne('SELECT COUNT(*) AS n FROM foto_conteudos WHERE foto_id=?',[metadata.id])).n,1);
  const other=(await query("INSERT INTO colaboradores (nome,matricula,status) VALUES ('Outra pessoa teste','PHOTO-OTHER','ATIVO')"))[0].id;
  assert.equal((await request('fotos/'+other,'POST',{imagem:'data:image/jpeg;base64,'+image.toString('base64')})).status,400);
});

test('fotos antigas são importadas, verificadas e continuam disponíveis sem o disco',async()=>{
  const {readPhoto,importPhotoFiles,photoFolder}=require('../dist/services/PhotoStorage');
  const sharp=require('sharp');const bytes=await sharp({create:{width:8,height:8,channels:3,background:'#228866'}}).jpeg().toBuffer();
  const filename=crypto.randomUUID()+'.jpg',file=path.join(photoFolder,filename),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  await fs.promises.mkdir(photoFolder,{recursive:true});await fs.promises.writeFile(file,bytes);
  try{
    const row=await query('INSERT INTO fotos (colaborador_id,arquivo,sha256,tamanho,largura,altura,responsavel_id,created_at) VALUES (?,?,?,?,?,?,?,?)',[collaborator,filename,hash,bytes.length,8,8,admin,new Date().toISOString()]);
    assert.deepEqual(await readPhoto(filename),bytes);assert.equal(await importPhotoFiles(),1);assert.equal(await importPhotoFiles(),0);
    await fs.promises.unlink(file);assert.deepEqual(await readPhoto(filename),bytes);
    await query('UPDATE foto_conteudos SET imagem_base64=? WHERE foto_id=?',[Buffer.from('corrompida').toString('base64'),row[0].id]);
    await assert.rejects(readPhoto(filename),/integridade/);
    await query('UPDATE foto_conteudos SET imagem_base64=? WHERE foto_id=?',[bytes.toString('base64'),row[0].id]);
  }finally{await fs.promises.unlink(file).catch(()=>{});}
});

test('backup MySQL preserva fotografias armazenadas somente no banco',{skip:!mysqlMode},async()=>{
  const {backupMysql}=require('../dist/database/backup');const folder=await backupMysql();
  const manifest=JSON.parse(await fs.promises.readFile(path.join(folder,'manifest.json'),'utf8'));
  assert.ok(manifest.tables.some(table=>table.table==='foto_conteudos'&&table.count>=2));
  for(const photo of manifest.photos){const bytes=await fs.promises.readFile(path.join(folder,'photos',photo.arquivo));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),photo.sha256);}
});
