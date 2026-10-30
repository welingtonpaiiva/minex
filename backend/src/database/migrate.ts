import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { databaseClient, query, queryOne, closeDatabase, withTransaction } from '../config/db';

function source(name: string) {
  for (const folder of [__dirname, path.resolve(__dirname, '../../src/database')]) {
    const file = path.join(folder, name);
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  }
  throw new Error('Migration ausente: ' + name);
}
export function mysqlDDL(statement: string) {
  let sql = statement.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INTEGER PRIMARY KEY AUTO_INCREMENT')
    .replace(/\bTEXT\b/g, 'VARCHAR(255)')
    .replace(/\(datetime\('now',\s*'localtime'\)\)/g, 'CURRENT_TIMESTAMP(3)')
    .replace(/(\b(?:created_at|updated_at|data_hora|data_hora_saida)\s+)VARCHAR\(255\)/g, '$1DATETIME(3)')
    .replace(/\b(resposta_json|detalhes|dados_json|sql_original|imagem_base64) VARCHAR\(255\)/g, '$1 MEDIUMTEXT')
    .replace(/\b(descricao|observacao|justificativa) VARCHAR\(255\)/g, '$1 VARCHAR(4000)')
    .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX');
  const foreignKeys: string[] = [];
  sql = sql.replace(/(\w+) ([^,\n]+?) REFERENCES (\w+)\((\w+)\)/g, (_, column, type, table, key) => {
    foreignKeys.push('FOREIGN KEY (' + column + ') REFERENCES ' + table + '(' + key + ')');
    return column + ' ' + type;
  });
  if (/^CREATE TABLE/.test(sql)) {
    if (foreignKeys.length) sql = sql.replace(/\)\s*$/, ', ' + foreignKeys.join(', ') + ')');
    sql += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
  }
  return sql;
}
export async function runMigrations() {
  await query('SELECT 1');
  await query('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at VARCHAR(32) NOT NULL)');
  for (const [version, file] of [[1, 'schema.sql'], [2, '002_operations.sql'], [3, '003_quantities_photos.sql'], [4, '004_legacy.sql'], [5, '005_photo_storage.sql'], [6, '006_kits.sql'], [7, '007_material_identification.sql'], [8, '008_material_photos.sql']] as const) {
    if (await queryOne('SELECT version FROM schema_migrations WHERE version = ?', [version])) continue;
    const statements = source(file).replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
    for (const statement of statements) {
      try { await query(databaseClient === 'mysql' ? mysqlDDL(statement) : statement); }
      catch (error: any) {
        if (!(databaseClient === 'mysql' && /^CREATE INDEX/.test(statement) && error.code === 'ER_DUP_KEYNAME')) throw error;
      }
    }
    await query('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [version, new Date().toISOString()]);
  }
  await query('SELECT senha_hash FROM usuarios LIMIT 1');
  await query('SELECT nfc_id FROM colaboradores LIMIT 1');
  const collaboratorColumns: any[] = databaseClient === 'mysql'
    ? await query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'colaboradores'")
    : await query('PRAGMA table_info(colaboradores)');
  for (const [name, type] of [
    ['empresa', "VARCHAR(255) NOT NULL DEFAULT ''"], ['turma', "VARCHAR(32) NOT NULL DEFAULT ''"],
    ['brigadista', 'INTEGER NOT NULL DEFAULT 0'], ['brigada_especialidade', "VARCHAR(255) NOT NULL DEFAULT ''"],
    ['brigada_validade', 'VARCHAR(10)']
  ]) {
    if (!collaboratorColumns.some(c => c.name === name)) await query('ALTER TABLE colaboradores ADD COLUMN ' + name + ' ' + type);
  }
  const columns: any[] = databaseClient === 'mysql'
    ? await query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emprestimos'")
    : await query('PRAGMA table_info(emprestimos)');
  for (const [name, type] of [['prazo_devolucao', 'VARCHAR(32)'], ['destino', "VARCHAR(255) NOT NULL DEFAULT ''"], ['kit_nome', 'VARCHAR(255)']]) {
    if (!columns.some(c => c.name === name)) await query('ALTER TABLE emprestimos ADD COLUMN ' + name + ' ' + type);
  }
  if (!columns.some(c => c.name === 'kit_nome')) {
    // Kits entregues antes desta restrição já foram removidos de kits.
    // Recuperar o vínculo pela última retirada de cada empréstimo ainda ativo.
    await withTransaction(async execute => {
      const loans = await execute(`SELECT e.id, e.colaborador_id, r.id AS retirada_id, r.detalhes
        FROM emprestimos e JOIN auditoria r ON r.id = (
          SELECT MAX(a.id) FROM auditoria a
          WHERE a.acao = 'RETIRADA' AND a.entidade = 'material' AND a.referencia_id = e.material_id
        )`);
      for (const loan of loans) {
        const withdrawal = JSON.parse(loan.detalhes);
        if (Number(withdrawal.colaborador_id) !== Number(loan.colaborador_id)) continue;
        const assignments = await execute(`SELECT detalhes FROM auditoria
          WHERE acao = 'ATRIBUICAO_KIT' AND entidade = 'colaborador' AND referencia_id = ? AND id > ? ORDER BY id`,
          [loan.colaborador_id, loan.retirada_id]);
        for (const assignment of assignments) {
          const kit = JSON.parse(assignment.detalhes);
          if (Array.isArray(kit.materiais) && kit.materiais.includes(withdrawal.codigo)) {
            await execute('UPDATE emprestimos SET kit_nome = ? WHERE id = ?', [kit.kit_nome, loan.id]);
            break;
          }
        }
      }
    });
  }
  const materialColumns: any[] = databaseClient === 'mysql'
    ? await query("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materiais'")
    : await query('PRAGMA table_info(materiais)');
  for (const [name, type] of [['tipo_controle', "VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL'"], ['saldo_disponivel', 'INTEGER NOT NULL DEFAULT 0'], ['saldo_conferencia', 'INTEGER NOT NULL DEFAULT 0'], ['saldo_manutencao', 'INTEGER NOT NULL DEFAULT 0']]) {
    if (!materialColumns.some(c => c.name === name)) await query('ALTER TABLE materiais ADD COLUMN ' + name + ' ' + type);
  }
  if (!(await queryOne('SELECT id FROM usuarios LIMIT 1')) && process.env.INITIAL_ADMIN_PASSWORD) {
    if (process.env.INITIAL_ADMIN_PASSWORD.length < 12) throw new Error('INITIAL_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres');
    await query('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)',
      ['Administrador', process.env.INITIAL_ADMIN_MATRICULA || 'admin', await bcrypt.hash(process.env.INITIAL_ADMIN_PASSWORD, 12), 'ADMINISTRADOR', 'ATIVO']);
  }
  console.log('[MIGRATE] Estrutura ' + databaseClient + ' atualizada; dados existentes preservados.');
}
if (require.main === module) runMigrations().then(closeDatabase).catch(error => { console.error(error); process.exitCode = 1; });
