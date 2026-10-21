"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupMysql = backupMysql;
exports.restoreMysql = restoreMysql;
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const readline_1 = require("readline");
const fs_1 = require("fs");
const db_1 = require("../config/db");
const migrateToMysql_1 = require("./migrateToMysql");
const migrate_1 = require("./migrate");
const PhotoStorage_1 = require("../services/PhotoStorage");
const root = path_1.default.resolve(__dirname, '../../../backups');
async function backupMysql() {
    if (db_1.databaseClient !== 'mysql')
        throw new Error('Backup online exige DB_CLIENT=mysql');
    const directory = path_1.default.join(root, 'mysql-' + new Date().toISOString().replace(/[:.]/g, '-'));
    await promises_1.default.mkdir(directory, { recursive: true });
    const connection = await (0, db_1.mysqlPool)().getConnection();
    const manifest = { version: 1, created_at: new Date().toISOString(), database: process.env.MYSQL_DATABASE, tables: [], photos: [], sequences: {} };
    try {
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        for (const table of migrateToMysql_1.migrationTables) {
            const file = path_1.default.join(directory, table + '.ndjson'), hash = crypto_1.default.createHash('sha256');
            await promises_1.default.writeFile(file, '', { flag: 'wx' });
            let count = 0, last = 0;
            while (true) {
                const [rows] = await connection.query('SELECT * FROM `' + table + '` WHERE id>? ORDER BY id LIMIT 500', [last]);
                if (!rows.length)
                    break;
                const text = rows.map((row) => JSON.stringify(row) + '\n').join('');
                await promises_1.default.appendFile(file, text);
                hash.update(text);
                count += rows.length;
                last = rows[rows.length - 1].id;
            }
            manifest.tables.push({ table, count, sha256: hash.digest('hex') });
            const [sequence] = await connection.query('SELECT AUTO_INCREMENT AS next_id FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?', [table]);
            if (sequence[0]?.next_id)
                manifest.sequences[table] = Number(sequence[0].next_id);
        }
        const [photos] = await connection.query('SELECT arquivo,sha256 FROM fotos');
        await promises_1.default.mkdir(path_1.default.join(directory, 'photos'));
        for (const photo of photos) {
            if (!/^[a-f0-9-]{36}\.jpg$/.test(photo.arquivo))
                throw new Error('Referência de foto inválida no banco');
            const content = await (0, PhotoStorage_1.readPhoto)(photo.arquivo, async (sql, params) => (await connection.query(sql, params))[0]);
            if (crypto_1.default.createHash('sha256').update(content).digest('hex') !== photo.sha256)
                throw new Error('Foto com integridade inválida: ' + photo.arquivo);
            await promises_1.default.writeFile(path_1.default.join(directory, 'photos', photo.arquivo), content, { flag: 'wx' });
            manifest.photos.push(photo);
        }
        await connection.commit();
        await promises_1.default.writeFile(path_1.default.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
        console.log('Backup consistente criado: ' + directory);
        return directory;
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
async function restoreMysql(directory) {
    if (db_1.databaseClient !== 'mysql')
        throw new Error('Configure o MySQL de destino');
    if (process.env.RESTORE_EMPTY_DATABASE !== '1')
        throw new Error('Configure RESTORE_EMPTY_DATABASE=1 e use um banco vazio');
    const folder = path_1.default.resolve(directory), manifest = JSON.parse(await promises_1.default.readFile(path_1.default.join(folder, 'manifest.json'), 'utf8'));
    if (manifest.version !== 1 || !Array.isArray(manifest.tables))
        throw new Error('Backup incompatível');
    for (const record of manifest.tables) {
        if (!migrateToMysql_1.migrationTables.includes(record.table))
            throw new Error('Tabela não reconhecida no backup');
        const hash = crypto_1.default.createHash('sha256');
        for await (const chunk of (0, fs_1.createReadStream)(path_1.default.join(folder, record.table + '.ndjson')))
            hash.update(chunk);
        if (hash.digest('hex') !== record.sha256)
            throw new Error('Checksum inválido: ' + record.table);
    }
    for (const photo of manifest.photos) {
        if (!/^[a-f0-9-]{36}\.jpg$/.test(photo.arquivo))
            throw new Error('Foto inválida no backup');
        const bytes = await promises_1.default.readFile(path_1.default.join(folder, 'photos', photo.arquivo));
        if (crypto_1.default.createHash('sha256').update(bytes).digest('hex') !== photo.sha256)
            throw new Error('Checksum inválido da foto');
    }
    await (0, migrate_1.runMigrations)();
    const connection = await (0, db_1.mysqlPool)().getConnection();
    try {
        for (const table of migrateToMysql_1.migrationTables) {
            const [rows] = await connection.query('SELECT COUNT(*) AS total FROM `' + table + '`');
            if (rows[0].total)
                throw new Error('Destino não vazio: ' + table);
        }
        await connection.beginTransaction();
        for (const record of manifest.tables) {
            let count = 0;
            const hash = crypto_1.default.createHash('sha256');
            const lines = (0, readline_1.createInterface)({ input: (0, fs_1.createReadStream)(path_1.default.join(folder, record.table + '.ndjson')), crlfDelay: Infinity });
            for await (const line of lines) {
                if (!line)
                    continue;
                const row = JSON.parse(line), columns = Object.keys(row);
                if (columns.some(c => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)))
                    throw new Error('Coluna inválida no backup');
                await connection.query('INSERT INTO `' + record.table + '` (' + columns.map(c => '`' + c + '`').join(',') + ') VALUES (' + columns.map(() => '?').join(',') + ')', columns.map(c => row[c]));
                count++;
            }
            let last = 0;
            while (true) {
                const [rows] = await connection.query('SELECT * FROM `' + record.table + '` WHERE id>? ORDER BY id LIMIT 500', [last]);
                if (!rows.length)
                    break;
                for (const row of rows)
                    hash.update(JSON.stringify(row) + '\n');
                last = rows[rows.length - 1].id;
            }
            if (count !== record.count || hash.digest('hex') !== record.sha256)
                throw new Error('Conferência de restauração falhou: ' + record.table);
        }
        await promises_1.default.mkdir(path_1.default.resolve(__dirname, '../../uploads'), { recursive: true });
        for (const photo of manifest.photos)
            await promises_1.default.copyFile(path_1.default.join(folder, 'photos', photo.arquivo), path_1.default.resolve(__dirname, '../../uploads', photo.arquivo));
        await connection.commit();
        for (const [table, value] of Object.entries(manifest.sequences || {})) {
            if (!migrateToMysql_1.migrationTables.includes(table) || !Number.isSafeInteger(value) || Number(value) < 1)
                throw new Error('Sequência inválida');
            await connection.query('ALTER TABLE `' + table + '` AUTO_INCREMENT=' + value);
        }
        console.log('Restauração conferida: contagens, conteúdo, sequências e fotografias.');
    }
    catch (error) {
        await connection.rollback();
        throw error;
    }
    finally {
        connection.release();
    }
}
if (require.main === module) {
    const task = process.argv[2] === 'restore' ? restoreMysql(process.argv[3]) : backupMysql();
    task.then(db_1.closeDatabase).catch(async (error) => { console.error(error.message); await (0, db_1.closeDatabase)(); process.exitCode = 1; });
}
