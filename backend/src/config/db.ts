import path from 'path';
import sqlite3 from 'sqlite3';
import mysql, { Pool, PoolConnection } from 'mysql2/promise';
import { AsyncLocalStorage } from 'async_hooks';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const databaseClient = process.env.DB_CLIENT || (process.env.MYSQL_HOST ? 'mysql' : 'sqlite');
if (!['sqlite', 'mysql'].includes(databaseClient)) throw new Error('DB_CLIENT deve ser sqlite ou mysql');
export const sqlitePath = path.resolve(process.env.SQLITE_PATH || path.join(__dirname, '../../../minex.db'));
export const lockRow = databaseClient === 'mysql' ? ' FOR UPDATE' : '';
export type Executor = <T = any>(sql: string, params?: any[]) => Promise<T[]>;
const context = new AsyncLocalStorage<Executor>();
let pool: Pool | undefined;
let sqlite: sqlite3.Database | undefined;
let queue = Promise.resolve();
async function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await work(); } finally { release(); }
}

export function mysqlPool() {
  if (!pool) {
    if (!process.env.MYSQL_USER || !process.env.MYSQL_DATABASE) throw new Error('Configure MYSQL_USER e MYSQL_DATABASE');
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE, connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
      waitForConnections: true, queueLimit: 100, connectTimeout: 10000, timezone: 'Z', dateStrings: true,
      charset: 'utf8mb4', multipleStatements: false
    });
    pool.on('connection', connection => { connection.query("SET time_zone = '+00:00'"); });
  }
  return pool;
}

function sqlForDriver(sql: string) {
  if (databaseClient === 'sqlite' && /^\s*CREATE\b/i.test(sql)) return sql;
  const now = new Date().toISOString();
  let result = sql.replace(/\(?datetime\('now',\s*'localtime'\)\)?/gi, `'${databaseClient === 'mysql' ? now.slice(0, 23).replace('T', ' ') : now}'`);
  if (databaseClient === 'mysql') result = result.replace(/LTRIM\((\w+), '0'\)/g, "TRIM(LEADING '0' FROM $1)");
  return result;
}
async function mysqlQuery(connection: Pool | PoolConnection, sql: string, params: any[] = []) {
  const [rows]: any = await connection.query(sqlForDriver(sql), params.map(value =>
    typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
      ? value.slice(0, 23).replace('T', ' ') : value));
  if (!Array.isArray(rows)) return [{ id: rows.insertId, changes: rows.affectedRows }];
  for (const row of rows) for (const field of Object.keys(row)) {
    if (typeof row[field] === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(row[field])) row[field] = row[field].replace(' ', 'T') + 'Z';
  }
  return rows;
}
let ready: Promise<void> | undefined;
function openSqlite() {
  if (!ready) ready = new Promise<void>((resolve, reject) => {
    sqlite = new sqlite3.Database(sqlitePath, err => {
      if (err) return reject(err);
      sqlite!.configure('busyTimeout', 10000);
      sqlite!.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;', e => e ? reject(e) : resolve());
    });
  });
  return ready;
}
const sqliteQuery: Executor = async (sql, params = []) => {
  await openSqlite();
  const normalized = sqlForDriver(sql);
  return new Promise<any[]>((resolve, reject) => {
    if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(normalized)) {
      sqlite!.all(normalized, params, (err, rows) => err ? reject(err) : resolve(rows));
    } else {
      sqlite!.run(normalized, params, function(err) { err ? reject(err) : resolve([{ id: this.lastID, changes: this.changes }]); });
    }
  });
};
export const query: Executor = async (sql, params = []) => {
  const transaction = context.getStore();
  if (transaction) return transaction(sql, params);
  if (databaseClient === 'mysql') return mysqlQuery(mysqlPool(), sql, params);
  return exclusive(() => sqliteQuery(sql, params));
};
export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return (await query<T>(sql, params))[0] || null;
}
export async function withTransaction<T>(callback: (execute: Executor) => Promise<T>): Promise<T> {
  const existing = context.getStore();
  if (existing) return callback(existing);
  if (databaseClient === 'mysql') {
    const connection = await mysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      const execute: Executor = (sql, params) => mysqlQuery(connection, sql, params);
      const result = await context.run(execute, () => callback(execute));
      await connection.commit();
      return result;
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
  return exclusive(async () => {
    await sqliteQuery('BEGIN IMMEDIATE');
    try {
      const result = await context.run(sqliteQuery, () => callback(sqliteQuery));
      await sqliteQuery('COMMIT');
      return result;
    } catch (error) { await sqliteQuery('ROLLBACK'); throw error; }
  });
}
export async function closeDatabase() {
  if (pool) await pool.end();
  if (sqlite) await new Promise<void>((resolve, reject) => sqlite!.close(e => e ? reject(e) : resolve()));
}
