import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sqlite3 from 'sqlite3';
import { mysqlPool, databaseClient, closeDatabase } from '../config/db';
import { runMigrations } from './migrate';

export const migrationTables = ['usuarios', 'colaboradores', 'categorias', 'materiais', 'emprestimos', 'movimentacoes', 'treinamentos', 'colaborador_treinamentos', 'acessos_mina', 'emprestimos_quantidade', 'extravios', 'fotos', 'foto_conteudos', 'requisicoes', 'auditoria', 'legado_esquemas', 'legado_registros'];
export function sqliteRead(db: sqlite3.Database, sql: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
}
export function migrateValue(column: string, value: any) {
  if (typeof value !== 'string' || !/^(?:created_at|updated_at|data_hora|data_hora_saida|entrada|saida|retirada|identificado_em|prazo_devolucao)$/.test(column) || !value) return value;
  const parsed = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + (process.env.LEGACY_TIME_OFFSET || '-03:00'));
  if (Number.isNaN(parsed.getTime())) throw new Error('Data inválida no campo ' + column + ': ' + value);
  return parsed.toISOString().slice(0, 23).replace('T', ' ');
}
export async function migrateToMysql() {
  if (databaseClient !== 'mysql') throw new Error('Configure DB_CLIENT=mysql e as variáveis MYSQL_*');
  if (process.env.MIGRATION_OFFLINE !== '1') throw new Error('Pare as gravações do sistema e configure MIGRATION_OFFLINE=1 antes da transferência');
  if (process.env.INITIAL_ADMIN_PASSWORD) throw new Error('Remova INITIAL_ADMIN_PASSWORD durante a transferência');
  const original = path.resolve(process.env.SQLITE_SOURCE || path.join(__dirname, '../../../minex.db'));
  if (!fs.existsSync(original)) throw new Error('SQLite de origem não encontrado');
  const folder = path.resolve(__dirname, '../../../backups'); fs.mkdirSync(folder, { recursive: true });
  const snapshot = path.join(folder, 'pre-mysql-' + Date.now() + '.db');
  const source = new sqlite3.Database(original, sqlite3.OPEN_READONLY);
  try {
    const integrity = await sqliteRead(source, 'PRAGMA integrity_check');
    if (integrity[0].integrity_check !== 'ok') throw new Error('SQLite apresenta falha de integridade');
    const violations = await sqliteRead(source, 'PRAGMA foreign_key_check');
    if (violations.length) throw new Error('Relacionamentos órfãos no SQLite; corrija antes da transferência: ' + JSON.stringify(violations));
    await sqliteRead(source, "VACUUM INTO '" + snapshot.replace(/'/g, "''") + "'");
  } finally { await new Promise<void>((resolve, reject) => source.close(err => err ? reject(err) : resolve())); }
  const db = new sqlite3.Database(snapshot, sqlite3.OPEN_READONLY);
  const connection = await mysqlPool().getConnection();
  const report: any = { original, snapshot, iniciado_em: new Date().toISOString(), tabelas: [], concluido: false };
  try {
    await runMigrations();
    for (const table of migrationTables) {
      const [count]: any = await connection.query('SELECT COUNT(*) AS total FROM `' + table + '`');
      if (count[0].total) throw new Error('O destino deve estar vazio: ' + table);
    }
    await connection.beginTransaction();
    for (const table of migrationTables) {
      const exists = await sqliteRead(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [table]);
      if (!exists.length) continue;
      const columns = (await sqliteRead(db, 'PRAGMA table_info(' + table + ')')).map(c => c.name);
      const [targetColumns]: any = await connection.query('SHOW COLUMNS FROM `' + table + '`');
      const valid = new Set(targetColumns.map((c: any) => c.Field));
      if (columns.some(c => !valid.has(c))) throw new Error('Colunas sem correspondência: ' + table);
      let count = 0, lastId = 0; const hash = crypto.createHash('sha256');
      while (true) {
        const rows = await sqliteRead(db, 'SELECT * FROM ' + table + ' WHERE id > ? ORDER BY id LIMIT 500', [lastId]);
        if (!rows.length) break;
        for (const row of rows) {
          const values = columns.map(c => migrateValue(c, row[c]));
          hash.update(JSON.stringify(values));
          await connection.query('INSERT INTO `' + table + '` (' + columns.map(c => '`' + c + '`').join(',') + ') VALUES (' + columns.map(() => '?').join(',') + ')', values);
          lastId = row.id; count++;
        }
      }
      const sourceHash = hash.digest('hex'), targetHash = crypto.createHash('sha256');
      let targetId = 0, targetCount = 0;
      while (true) {
        const [rows]: any = await connection.query('SELECT * FROM `' + table + '` WHERE id > ? ORDER BY id LIMIT 500', [targetId]);
        if (!rows.length) break;
        for (const row of rows) {
          targetHash.update(JSON.stringify(columns.map(c => {
            const value = row[c];
            // DATETIME(3) returns .000; normalize source values to the same representation.
            return typeof value === 'string' && /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(value) ? value + '.000' : value;
          })));
          targetId = row.id; targetCount++;
        }
      }
      if (targetCount !== count || targetHash.digest('hex') !== sourceHash) throw new Error('Conferência de dados falhou: ' + table);
      report.tabelas.push({ tabela: table, registros: count, sha256: sourceHash });
    }
    // Preserve tables from previous application generations without guessing how
    // equipment codes or historical relationships map onto the active catalog.
    const allTables = await sqliteRead(db, "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    report.legado = [];
    for (const table of allTables.filter(t => !migrationTables.includes(t.name) && t.name !== 'schema_migrations')) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table.name)) throw new Error('Nome de tabela legada inválido');
      await connection.query('INSERT INTO legado_esquemas (tabela, sql_original) VALUES (?, ?)', [table.name, table.sql]);
      const rows = await sqliteRead(db, 'SELECT rowid AS __original_rowid, * FROM "' + table.name + '" ORDER BY rowid');
      const hash = crypto.createHash('sha256');
      for (const row of rows) {
        const ref = row.id ?? row.__original_rowid; delete row.__original_rowid;
        const json = JSON.stringify(row); hash.update(json);
        await connection.query('INSERT INTO legado_registros (tabela, registro_id, dados_json) VALUES (?, ?, ?)', [table.name, ref, json]);
      }
      const digest = hash.digest('hex'), targetHash = crypto.createHash('sha256');
      const [copied]: any = await connection.query('SELECT dados_json FROM legado_registros WHERE tabela=? ORDER BY id', [table.name]);
      copied.forEach((r: any) => targetHash.update(r.dados_json));
      if (copied.length !== rows.length || targetHash.digest('hex') !== digest) throw new Error('Conferência do legado falhou: ' + table.name);
      report.legado.push({ tabela: table.name, registros: rows.length, sha256: digest });
    }
    const [inconsistent]: any = await connection.query("SELECT m.id FROM materiais m LEFT JOIN emprestimos e ON e.material_id=m.id WHERE m.tipo_controle='INDIVIDUAL' AND ((m.status='EM_USO' AND e.id IS NULL) OR (m.status<>'EM_USO' AND e.id IS NOT NULL))");
    if (inconsistent.length) throw new Error('Estoque inconsistente na origem; transferência revertida');
    await connection.commit();
    // Preserve SQLite AUTOINCREMENT sequences, including deleted active-loan IDs used by occurrences.
    for (const table of migrationTables) {
      const sequence = await sqliteRead(db, 'SELECT seq FROM sqlite_sequence WHERE name = ?', [table]);
      if (sequence.length) await connection.query('ALTER TABLE `' + table + '` AUTO_INCREMENT = ' + (Number(sequence[0].seq) + 1));
    }
    report.concluido = true; report.finalizado_em = new Date().toISOString();
    console.log('Transferência conferida. Valide os fluxos e uma restauração de backup antes de liberar o MySQL.');
  } catch (error: any) { await connection.rollback(); report.erro = error.message; throw error; }
  finally {
    connection.release(); await new Promise<void>(resolve => db.close(() => resolve()));
    const reportFile = snapshot + '.report.json'; fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log('Relatório: ' + reportFile);
  }
}
if (require.main === module) migrateToMysql().then(closeDatabase).catch(async error => { console.error(error.message); await closeDatabase(); process.exitCode = 1; });
