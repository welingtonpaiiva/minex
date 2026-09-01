"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
exports.queryOne = queryOne;
exports.withTransaction = withTransaction;
const path_1 = __importDefault(require("path"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Configuração do PostgreSQL
const usePostgres = process.env.DATABASE_URL || process.env.PGHOST;
let pgPool = null;
let sqliteDb = null;
const dbPath = path_1.default.resolve(__dirname, '../../../minex.db');
if (usePostgres) {
    pgPool = new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
        host: process.env.PGHOST || 'localhost',
        port: parseInt(process.env.PGPORT || '5432'),
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'casa_da_lanterna',
    });
    console.log('[DB] Conectado ao PostgreSQL');
}
else {
    sqliteDb = new sqlite3_1.default.Database(dbPath, (err) => {
        if (err) {
            console.error('[DB] Erro ao abrir SQLite:', err.message);
        }
        else {
            console.log('[DB] Conectado ao SQLite local:', dbPath);
        }
    });
}
// Abstração universal de Query para PostgreSQL e SQLite
async function query(sql, params = []) {
    if (pgPool) {
        // Converter placeholders ? do SQLite para $1, $2 do PG se necessário
        let pgSql = sql;
        let paramIndex = 1;
        while (pgSql.includes('?')) {
            pgSql = pgSql.replace('?', `$${paramIndex++}`);
        }
        const res = await pgPool.query(pgSql, params);
        return res.rows;
    }
    else if (sqliteDb) {
        return new Promise((resolve, reject) => {
            // Normalizar comandos SQL para SQLite se houver diferenças de sintaxe
            let normSql = sql.replace(/BOOLEAN/gi, 'INTEGER')
                .replace(/CURRENT_TIMESTAMP/gi, "datetime('now', 'localtime')");
            if (normSql.trim().toUpperCase().startsWith('SELECT') || normSql.trim().toUpperCase().startsWith('PRAGMA')) {
                sqliteDb.all(normSql, params, (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });
            }
            else {
                sqliteDb.run(normSql, params, function (err) {
                    if (err)
                        reject(err);
                    else
                        resolve([{ id: this.lastID, changes: this.changes }]);
                });
            }
        });
    }
    else {
        throw new Error('Nenhum banco de dados configurado');
    }
}
async function queryOne(sql, params = []) {
    const rows = await query(sql, params);
    return rows.length > 0 ? rows[0] : null;
}
// Gerenciador de Transações Atômicas
async function withTransaction(callback) {
    if (pgPool) {
        const client = await pgPool.connect();
        try {
            await client.query('BEGIN');
            const transactionQuery = async (sql, params = []) => {
                let pgSql = sql;
                let paramIndex = 1;
                while (pgSql.includes('?')) {
                    pgSql = pgSql.replace('?', `$${paramIndex++}`);
                }
                const res = await client.query(pgSql, params);
                return res.rows;
            };
            const result = await callback(transactionQuery);
            await client.query('COMMIT');
            return result;
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
    }
    else if (sqliteDb) {
        return new Promise(async (resolve, reject) => {
            sqliteDb.serialize(async () => {
                try {
                    await query('BEGIN TRANSACTION');
                    const result = await callback(query);
                    await query('COMMIT');
                    resolve(result);
                }
                catch (err) {
                    try {
                        await query('ROLLBACK');
                    }
                    catch (_) { }
                    reject(err);
                }
            });
        });
    }
    else {
        throw new Error('Nenhum banco de dados configurado');
    }
}
