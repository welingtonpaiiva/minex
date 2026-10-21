const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const mysql=require('mysql2/promise');
const {spawn}=require('child_process');
const env=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.runtime/mysql.env')));
const database='minex_test_'+Date.now();
(async()=>{
  // This disposable database uses the existing local administrative connection;
  // no application account privileges or host grants are changed.
  const connection=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',password:env.MYSQL_ROOT_PASSWORD});
  await connection.query('CREATE DATABASE `'+database+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');
  await connection.end();
  console.log('MySQL isolado: '+database);
  const child=spawn(process.execPath,['--test','tests/operations.test.cjs'],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,MINEX_TEST_MYSQL:'1',DB_CLIENT:'mysql',MYSQL_HOST:'127.0.0.1',MYSQL_PORT:'3307',MYSQL_USER:'root',MYSQL_PASSWORD:env.MYSQL_ROOT_PASSWORD,MYSQL_DATABASE:database,JWT_SECRET:crypto.randomBytes(48).toString('hex')}});
  process.exitCode=await new Promise(resolve=>child.on('exit',code=>resolve(code||0)));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
