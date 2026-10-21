const sqlite3=require('sqlite3');
const path=require('path');
const source=path.resolve(__dirname,'../../minex.db');
const db=new sqlite3.Database(source,sqlite3.OPEN_READONLY);
const read=(sql,params=[])=>new Promise((resolve,reject)=>db.all(sql,params,(e,r)=>e?reject(e):resolve(r)));
(async()=>{
  const tables=await read("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const report={source,tables:{},integrity:await read('PRAGMA integrity_check'),foreignKeys:await read('PRAGMA foreign_key_check')};
  for(const t of tables)report.tables[t.name]=(await read('SELECT COUNT(*) AS total FROM '+t.name))[0].total;
  report.photos=await read("SELECT COUNT(*) AS total FROM colaboradores WHERE foto_url IS NOT NULL AND foto_url<>''");
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>db.close());
