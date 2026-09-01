import path from 'path';
import sqlite3 from 'sqlite3';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Configuração do PostgreSQL
const usePostgres = process.env.DATABASE_URL || process.env.PGHOST;

let pgPool: Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

const dbPath = path.resolve(__dirname, '../../../minex.db');

if (usePostgres) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432'),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    database: process.env.PGDATABASE || 'casa_da_lanterna',
  });
  console.log('[DB] Conectado ao PostgreSQL');
} else {
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[DB] Erro ao abrir SQLite:', err.message);
    } else {
      console.log('[DB] Conectado ao SQLite local:', dbPath);
    }
  });
}

// Abstração universal de Query para PostgreSQL e SQLite
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (pgPool) {
    // Converter placeholders ? do SQLite para $1, $2 do PG se necessário
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex++}`);
    }
    const res = await pgPool.query(pgSql, params);
    return res.rows as T[];
  } else if (sqliteDb) {
    return new Promise((resolve, reject) => {
      // Normalizar comandos SQL para SQLite se houver diferenças de sintaxe
      let normSql = sql.replace(/BOOLEAN/gi, 'INTEGER')
                       .replace(/CURRENT_TIMESTAMP/gi, "datetime('now', 'localtime')");
      
      if (normSql.trim().toUpperCase().startsWith('SELECT') || normSql.trim().toUpperCase().startsWith('PRAGMA')) {
        sqliteDb!.all(normSql, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows as T[]);
        });
      } else {
        sqliteDb!.run(normSql, params, function (err) {
          if (err) reject(err);
          else resolve([{ id: this.lastID, changes: this.changes }] as any);
        });
      }
    });
  } else {
    throw new Error('Nenhum banco de dados configurado');
  }
}

export async function queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Gerenciador de Transações Atômicas
export async function withTransaction<T>(callback: (execQuery: typeof query) => Promise<T>): Promise<T> {
  if (pgPool) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const transactionQuery = async (sql: string, params: any[] = []) => {
        let pgSql = sql;
        let paramIndex = 1;
        while (pgSql.includes('?')) {
          pgSql = pgSql.replace('?', `$${paramIndex++}`);
        }
        const res = await client.query(pgSql, params);
        return res.rows;
      };
      const result = await callback(transactionQuery as any);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else if (sqliteDb) {
    try {
      await query('BEGIN TRANSACTION');
      const result = await callback(query);
      await query('COMMIT');
      return result;
    } catch (err) {
      try {
        await query('ROLLBACK');
      } catch (_) {}
      throw err;
    }
  } else {
    throw new Error('Nenhum banco de dados configurado');
  }
}
