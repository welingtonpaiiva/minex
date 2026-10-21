"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.lockRow = exports.sqlitePath = exports.databaseClient = void 0;
exports.mysqlPool = mysqlPool;
exports.queryOne = queryOne;
exports.withTransaction = withTransaction;
exports.closeDatabase = closeDatabase;
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const promise_1 = __importDefault(require("mysql2/promise"));
const async_hooks_1 = require("async_hooks");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env') });
exports.databaseClient = process.env.DB_CLIENT || (process.env.MYSQL_HOST ? 'mysql' : 'sqlite');
if (!['sqlite', 'mysql'].includes(exports.databaseClient))
    throw new Error('DB_CLIENT deve ser sqlite ou mysql');
exports.sqlitePath = path_1.default.resolve(process.env.SQLITE_PATH || path_1.default.join(__dirname, '../../../minex.db'));
exports.lockRow = exports.databaseClient === 'mysql' ? ' FOR UPDATE' : '';
const context = new async_hooks_1.AsyncLocalStorage();
let pool;
let sqlite;
let queue = Promise.resolve();
async function exclusive(work) {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    try {
        return await work();
    }
    finally {
        release();
    }
}
function mysqlPool() {
    if (!pool) {
        if (!process.env.MYSQL_USER || !process.env.MYSQL_DATABASE)
            throw new Error('Configure MYSQL_USER e MYSQL_DATABASE');
        pool = promise_1.default.createPool({
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
function sqlForDriver(sql) {
    if (exports.databaseClient === 'sqlite' && /^\s*CREATE\b/i.test(sql))
        return sql;
    const now = new Date().toISOString();
    let result = sql.replace(/\(?datetime\('now',\s*'localtime'\)\)?/gi, `'${exports.databaseClient === 'mysql' ? now.slice(0, 23).replace('T', ' ') : now}'`);
    if (exports.databaseClient === 'mysql')
        result = result.replace(/LTRIM\((\w+), '0'\)/g, "TRIM(LEADING '0' FROM $1)");
    return result;
}
async function mysqlQuery(connection, sql, params = []) {
    const [rows] = await connection.query(sqlForDriver(sql), params.map(value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value)
        ? value.slice(0, 23).replace('T', ' ') : value));
    if (!Array.isArray(rows))
        return [{ id: rows.insertId, changes: rows.affectedRows }];
    for (const row of rows)
        for (const field of Object.keys(row)) {
            if (typeof row[field] === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d+)?$/.test(row[field]))
                row[field] = row[field].replace(' ', 'T') + 'Z';
        }
    return rows;
}
let ready;
function openSqlite() {
    if (!ready)
        ready = new Promise((resolve, reject) => {
            sqlite = new sqlite3_1.default.Database(exports.sqlitePath, err => {
                if (err)
                    return reject(err);
                sqlite.configure('busyTimeout', 10000);
                sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;', e => e ? reject(e) : resolve());
            });
        });
    return ready;
}
const sqliteQuery = async (sql, params = []) => {
    await openSqlite();
    const normalized = sqlForDriver(sql);
    return new Promise((resolve, reject) => {
        if (/^\s*(SELECT|PRAGMA|WITH)\b/i.test(normalized)) {
            sqlite.all(normalized, params, (err, rows) => err ? reject(err) : resolve(rows));
        }
        else {
            sqlite.run(normalized, params, function (err) { err ? reject(err) : resolve([{ id: this.lastID, changes: this.changes }]); });
        }
    });
};
const query = async (sql, params = []) => {
    const transaction = context.getStore();
    if (transaction)
        return transaction(sql, params);
    if (exports.databaseClient === 'mysql')
        return mysqlQuery(mysqlPool(), sql, params);
    return exclusive(() => sqliteQuery(sql, params));
};
exports.query = query;
async function queryOne(sql, params = []) {
    return (await (0, exports.query)(sql, params))[0] || null;
}
async function withTransaction(callback) {
    const existing = context.getStore();
    if (existing)
        return callback(existing);
    if (exports.databaseClient === 'mysql') {
        const connection = await mysqlPool().getConnection();
        try {
            await connection.beginTransaction();
            const execute = (sql, params) => mysqlQuery(connection, sql, params);
            const result = await context.run(execute, () => callback(execute));
            await connection.commit();
            return result;
        }
        catch (error) {
            await connection.rollback();
            throw error;
        }
        finally {
            connection.release();
        }
    }
    return exclusive(async () => {
        await sqliteQuery('BEGIN IMMEDIATE');
        try {
            const result = await context.run(sqliteQuery, () => callback(sqliteQuery));
            await sqliteQuery('COMMIT');
            return result;
        }
        catch (error) {
            await sqliteQuery('ROLLBACK');
            throw error;
        }
    });
}
async function closeDatabase() {
    if (pool)
        await pool.end();
    if (sqlite)
        await new Promise((resolve, reject) => sqlite.close(e => e ? reject(e) : resolve()));
}
