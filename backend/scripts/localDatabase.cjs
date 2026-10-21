const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const mysql=require('mysql2/promise');
const settings=require('dotenv').parse(fs.readFileSync(path.resolve(__dirname,'../.runtime/mysql.env')));
const action=process.argv[2];
Object.assign(process.env,{DB_CLIENT:'mysql',MYSQL_HOST:'127.0.0.1',MYSQL_PORT:'3307',MYSQL_USER:settings.MYSQL_USER,MYSQL_PASSWORD:settings.MYSQL_PASSWORD,MYSQL_DATABASE:settings.MYSQL_DATABASE});
const {closeDatabase}=require('../dist/config/db');
(async()=>{
  if(action==='migrate'){
    process.env.MIGRATION_OFFLINE='1';process.env.SQLITE_SOURCE=path.resolve(__dirname,'../../minex.db');
    await require('../dist/database/migrateToMysql').migrateToMysql();
  }else if(action==='backup'){
    await require('../dist/database/backup').backupMysql();
  }else if(action==='restore-test'){
    const backup=await require('../dist/database/backup').backupMysql();
    await closeDatabase();
    const db='minex_restore_'+Date.now(),connection=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',password:settings.MYSQL_ROOT_PASSWORD});
    await connection.query('CREATE DATABASE `'+db+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin');await connection.end();
    const {spawn}=require('child_process');
    const child=spawn(process.execPath,['dist/database/backup.js','restore',backup],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,MYSQL_DATABASE:db,MYSQL_USER:'root',MYSQL_PASSWORD:settings.MYSQL_ROOT_PASSWORD,RESTORE_EMPTY_DATABASE:'1'}});
    const code=await new Promise(resolve=>child.on('exit',resolve));if(code)throw new Error('A restauração de teste falhou');
    fs.writeFileSync(path.resolve(__dirname,'../../docs/restauracao-validada.json'),JSON.stringify({backup,destino:db,validado_em:new Date().toISOString(),resultado:'Contagens, SHA-256, sequências e fotografias conferidos'},null,2));
    console.log('Base de restauração conferida: '+db);return;
  }else if(action==='configure'){
    const file=path.resolve(__dirname,'../.env');
    if(fs.existsSync(file))throw new Error('Já existe .env; preserve a configuração existente');
    const secretFile=path.resolve(__dirname,'../.runtime/jwt-secret');
    const secret=fs.existsSync(secretFile)?fs.readFileSync(secretFile,'utf8').trim():crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(file,['DB_CLIENT=mysql','MYSQL_HOST=127.0.0.1','MYSQL_PORT=3307','MYSQL_USER='+settings.MYSQL_USER,'MYSQL_PASSWORD='+settings.MYSQL_PASSWORD,'MYSQL_DATABASE='+settings.MYSQL_DATABASE,'JWT_SECRET='+secret,'PORT=5000','RUN_MIGRATIONS=0','BACKUP_INTERVAL_HOURS=24','APP_TIMEZONE=America/Sao_Paulo','LEGACY_TIME_OFFSET=-03:00'].join('\n')+'\n',{flag:'wx',mode:0o600});
    const connection=await mysql.createConnection({host:'127.0.0.1',port:3307,user:'root',password:settings.MYSQL_ROOT_PASSWORD});
    // Narrow the account created by the local Docker image to application DML.
    await connection.query('REVOKE ALTER, CREATE, DROP, INDEX, REFERENCES, CREATE VIEW, SHOW VIEW, TRIGGER, EXECUTE, EVENT, LOCK TABLES, CREATE ROUTINE, ALTER ROUTINE, CREATE TEMPORARY TABLES ON `minex`.* FROM ?@?',[settings.MYSQL_USER,'%']);
    await connection.end();console.log('Configuração local gravada; conta da aplicação limitada a leitura e gravação.');
  }else throw new Error('Use migrate, backup, restore-test ou configure');
  await closeDatabase();
})().catch(async error=>{console.error(error.message);await closeDatabase().catch(()=>{});process.exitCode=1;});
