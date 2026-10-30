"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = require("../config/db");
const CatalogStandardization_1 = require("../services/CatalogStandardization");
async function main() {
    const databaseFlag = process.argv.indexOf('--database');
    if (db_1.databaseClient !== 'sqlite' || databaseFlag < 0 || !process.argv[databaseFlag + 1] ||
        path_1.default.resolve(process.argv[databaseFlag + 1]) !== db_1.sqlitePath) {
        throw new Error('Indique explicitamente o SQLite local configurado com --database CAMINHO.');
    }
    if (!fs_1.default.existsSync(db_1.sqlitePath))
        throw new Error('Banco não encontrado');
    const preview = await (0, CatalogStandardization_1.previewCatalogStandardization)();
    const { items, ...summary } = preview;
    console.log(JSON.stringify({ previa: summary }));
    if (!process.argv.includes('--apply'))
        return;
    if (preview.lanternas_faltantes.length)
        throw new Error('Complete o cadastro das lanternas faltantes antes de aplicar esta manutenção.');
    if (!preview.alterados) {
        console.log('Catálogo já padronizado. Nenhuma alteração.');
        return;
    }
    const directory = path_1.default.resolve(__dirname, '../../../backups/catalogo-' + new Date().toISOString().replace(/[:.]/g, '-'));
    fs_1.default.mkdirSync(directory, { recursive: true });
    const backup = path_1.default.join(directory, 'antes.db');
    await (0, db_1.query)('VACUUM INTO ?', [backup]);
    fs_1.default.writeFileSync(path_1.default.join(directory, 'previa.json'), JSON.stringify(preview, null, 2));
    const report = await (0, db_1.withTransaction)(async (execute) => {
        // Identidade técnica inativa: registra a execução local sem atribuí-la a um funcionário.
        let actor = await (0, db_1.queryOne)('SELECT id,status,nivel_acesso FROM usuarios WHERE matricula=?', ['__SISTEMA_CATALOGO__']);
        if (actor && (actor.status !== 'INATIVO' || actor.nivel_acesso !== 'CONSULTA'))
            throw new Error('Identidade técnica inesperada.');
        if (!actor)
            actor = (await execute('INSERT INTO usuarios (nome,matricula,senha_hash,nivel_acesso,status) VALUES (?,?,?,?,?)', ['Sistema - manutenção de catálogo', '__SISTEMA_CATALOGO__', '!SEM_LOGIN', 'CONSULTA', 'INATIVO']))[0];
        return (0, CatalogStandardization_1.applyCatalogStandardization)(preview.versao, actor.id);
    });
    fs_1.default.writeFileSync(path_1.default.join(directory, 'resultado.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ resultado: report, backup }));
}
if (require.main === module)
    main().then(db_1.closeDatabase).catch(async (error) => {
        console.error(error.message);
        await (0, db_1.closeDatabase)();
        process.exitCode = 1;
    });
