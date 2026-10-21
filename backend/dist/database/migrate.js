"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mysqlDDL = mysqlDDL;
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
function source(name) {
    for (const folder of [__dirname, path_1.default.resolve(__dirname, '../../src/database')]) {
        const file = path_1.default.join(folder, name);
        if (fs_1.default.existsSync(file))
            return fs_1.default.readFileSync(file, 'utf8');
    }
    throw new Error('Migration ausente: ' + name);
}
function mysqlDDL(statement) {
    let sql = statement.replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'INTEGER PRIMARY KEY AUTO_INCREMENT')
        .replace(/\bTEXT\b/g, 'VARCHAR(255)')
        .replace(/\(datetime\('now',\s*'localtime'\)\)/g, 'CURRENT_TIMESTAMP(3)')
        .replace(/(\b(?:created_at|updated_at|data_hora|data_hora_saida)\s+)VARCHAR\(255\)/g, '$1DATETIME(3)')
        .replace(/\b(resposta_json|detalhes|dados_json|sql_original|imagem_base64) VARCHAR\(255\)/g, '$1 MEDIUMTEXT')
        .replace(/\b(descricao|observacao|justificativa) VARCHAR\(255\)/g, '$1 VARCHAR(4000)')
        .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX');
    const foreignKeys = [];
    sql = sql.replace(/(\w+) ([^,\n]+?) REFERENCES (\w+)\((\w+)\)/g, (_, column, type, table, key) => {
        foreignKeys.push('FOREIGN KEY (' + column + ') REFERENCES ' + table + '(' + key + ')');
        return column + ' ' + type;
    });
    if (/^CREATE TABLE/.test(sql)) {
        if (foreignKeys.length)
            sql = sql.replace(/\)\s*$/, ', ' + foreignKeys.join(', ') + ')');
        sql += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin';
    }
    return sql;
}
async function runMigrations() {
    await (0, db_1.query)('SELECT 1');
    await (0, db_1.query)('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at VARCHAR(32) NOT NULL)');
    for (const [version, file] of [[1, 'schema.sql'], [2, '002_operations.sql'], [3, '003_quantities_photos.sql'], [4, '004_legacy.sql'], [5, '005_photo_storage.sql']]) {
        if (await (0, db_1.queryOne)('SELECT version FROM schema_migrations WHERE version = ?', [version]))
            continue;
        const statements = source(file).replace(/--[^\n]*/g, '').split(';').map(s => s.trim()).filter(Boolean);
        for (const statement of statements) {
            try {
                await (0, db_1.query)(db_1.databaseClient === 'mysql' ? mysqlDDL(statement) : statement);
            }
            catch (error) {
                if (!(db_1.databaseClient === 'mysql' && /^CREATE INDEX/.test(statement) && error.code === 'ER_DUP_KEYNAME'))
                    throw error;
            }
        }
        await (0, db_1.query)('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [version, new Date().toISOString()]);
    }
    await (0, db_1.query)('SELECT senha_hash FROM usuarios LIMIT 1');
    await (0, db_1.query)('SELECT nfc_id FROM colaboradores LIMIT 1');
    const columns = db_1.databaseClient === 'mysql'
        ? await (0, db_1.query)("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'emprestimos'")
        : await (0, db_1.query)('PRAGMA table_info(emprestimos)');
    for (const [name, type] of [['prazo_devolucao', 'VARCHAR(32)'], ['destino', "VARCHAR(255) NOT NULL DEFAULT ''"]]) {
        if (!columns.some(c => c.name === name))
            await (0, db_1.query)('ALTER TABLE emprestimos ADD COLUMN ' + name + ' ' + type);
    }
    const materialColumns = db_1.databaseClient === 'mysql'
        ? await (0, db_1.query)("SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='materiais'")
        : await (0, db_1.query)('PRAGMA table_info(materiais)');
    for (const [name, type] of [['tipo_controle', "VARCHAR(20) NOT NULL DEFAULT 'INDIVIDUAL'"], ['saldo_disponivel', 'INTEGER NOT NULL DEFAULT 0'], ['saldo_conferencia', 'INTEGER NOT NULL DEFAULT 0'], ['saldo_manutencao', 'INTEGER NOT NULL DEFAULT 0']]) {
        if (!materialColumns.some(c => c.name === name))
            await (0, db_1.query)('ALTER TABLE materiais ADD COLUMN ' + name + ' ' + type);
    }
    if (!(await (0, db_1.queryOne)('SELECT id FROM usuarios LIMIT 1')) && process.env.INITIAL_ADMIN_PASSWORD) {
        if (process.env.INITIAL_ADMIN_PASSWORD.length < 12)
            throw new Error('INITIAL_ADMIN_PASSWORD precisa ter pelo menos 12 caracteres');
        await (0, db_1.query)('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)', ['Administrador', process.env.INITIAL_ADMIN_MATRICULA || 'admin', await bcryptjs_1.default.hash(process.env.INITIAL_ADMIN_PASSWORD, 12), 'ADMINISTRADOR', 'ATIVO']);
    }
    console.log('[MIGRATE] Estrutura ' + db_1.databaseClient + ' atualizada; dados existentes preservados.');
}
if (require.main === module)
    runMigrations().then(db_1.closeDatabase).catch(error => { console.error(error); process.exitCode = 1; });
