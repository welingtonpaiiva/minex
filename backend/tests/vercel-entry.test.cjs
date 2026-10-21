const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHandler}=require('../../api/index');
const env={DB_CLIENT:'mysql',MYSQL_HOST:'database.example.com',MYSQL_USER:'test',MYSQL_PASSWORD:'fixture-only',MYSQL_DATABASE:'test',MYSQL_SSL:'true',JWT_SECRET:'fixture-only-secret-with-at-least-32-characters'};
const response=()=>({headers:{},setHeader(name,value){this.headers[name]=value;},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;}});
test('Vercel bloqueia banco local, TLS ausente e configuração incompleta sem inicializar a aplicação',async()=>{
  for(const config of [{},{...env,DB_CLIENT:'sqlite'},{...env,MYSQL_HOST:'127.0.0.1'},{...env,MYSQL_SSL:'false'},{...env,JWT_SECRET:'short'}]){
    let initialized=false;const handler=createHandler({env:config,initialize:async()=>{initialized=true;}}),res=response();
    await handler({url:'/api/auth/login'},res);assert.equal(res.statusCode,503);assert.equal(initialized,false);assert.equal(res.headers['Cache-Control'],'private, no-store');
  }
});
test('requisições concorrentes compartilham a inicialização e preservam caminho, corpo e autenticação',async()=>{
  let initialized=0,handled=0;
  const handler=createHandler({env,initialize:async()=>{initialized++;await new Promise(resolve=>setTimeout(resolve,20));return(req,res)=>{handled++;assert.equal(req.url,'/api/auth/login');assert.deepEqual(req.body,{matricula:'fixture'});assert.equal(req.headers.authorization,'Bearer fixture');res.status(200).json({ok:true});};}});
  const responses=await Promise.all(Array.from({length:8},async()=>{const res=response();await handler({url:'/api/auth/login',headers:{authorization:'Bearer fixture'},body:{matricula:'fixture'}},res);return res;}));
  assert.equal(initialized,1);assert.equal(handled,8);assert.ok(responses.every(r=>r.statusCode===200));
  const res=response();await handler({url:'/api/health'},res);assert.deepEqual(res.body,{status:'ok'});assert.equal(handled,8);
});
test('indisponibilidade do banco permite nova tentativa e não expõe erro interno',async()=>{
  let attempts=0;const handler=createHandler({env,initialize:async()=>{if(++attempts===1)throw Object.assign(new Error('private-connection-detail'),{code:'ECONNREFUSED'});return(_,res)=>res.status(200).json({ok:true});}});
  const failed=response();await handler({url:'/api/auth/me'},failed);assert.equal(failed.statusCode,503);assert.ok(!JSON.stringify(failed.body).includes('private-connection-detail'));
  const recovered=response();await handler({url:'/api/auth/me'},recovered);assert.equal(recovered.statusCode,200);assert.equal(attempts,2);
});
