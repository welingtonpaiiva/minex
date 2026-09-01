"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMigrations = runMigrations;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../config/db");
async function runMigrations() {
    console.log('[MIGRATE] Iniciando criação das tabelas...');
    let schemaPath = path_1.default.join(__dirname, 'schema.sql');
    if (!fs_1.default.existsSync(schemaPath)) {
        schemaPath = path_1.default.resolve(__dirname, '../../src/database/schema.sql');
    }
    if (!fs_1.default.existsSync(schemaPath)) {
        schemaPath = path_1.default.resolve(__dirname, '../src/database/schema.sql');
    }
    const sqlContent = fs_1.default.readFileSync(schemaPath, 'utf-8');
    // Dividir o script por instruções individuais
    const statements = sqlContent
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => stmt.length > 0);
    // Verificar se existem tabelas com schema legado e dropar para recriar com a estrutura correta
    try {
        const userCols = await (0, db_1.query)("PRAGMA table_info(usuarios)");
        const hasSenhaHash = Array.isArray(userCols) && userCols.some((col) => col.name === 'senha_hash');
        if (userCols.length > 0 && !hasSenhaHash) {
            console.log('[MIGRATE] Tabela usuarios legada detectada. Atualizando estrutura...');
            await (0, db_1.query)("DROP TABLE IF EXISTS emprestimos");
            await (0, db_1.query)("DROP TABLE IF EXISTS movimentacoes");
            await (0, db_1.query)("DROP TABLE IF EXISTS materiais");
            await (0, db_1.query)("DROP TABLE IF EXISTS categorias");
            await (0, db_1.query)("DROP TABLE IF EXISTS colaboradores");
            await (0, db_1.query)("DROP TABLE IF EXISTS usuarios");
        }
        const colabCols = await (0, db_1.query)("PRAGMA table_info(colaboradores)");
        const hasNfc = Array.isArray(colabCols) && colabCols.some((col) => col.name === 'nfc_id');
        if (colabCols.length > 0 && !hasNfc) {
            console.log('[MIGRATE] Tabela colaboradores legada detectada. Atualizando estrutura...');
            await (0, db_1.query)("DROP TABLE IF EXISTS emprestimos");
            await (0, db_1.query)("DROP TABLE IF EXISTS movimentacoes");
            await (0, db_1.query)("DROP TABLE IF EXISTS colaboradores");
        }
    }
    catch (e) {
        // Ignorar erro se tabela não existir
    }
    for (const stmt of statements) {
        try {
            await (0, db_1.query)(stmt);
        }
        catch (err) {
            // Ignorar erros secundários de índice existente
            if (!err.message?.includes('already exists')) {
                console.error('[MIGRATE] Erro ao executar SQL:', err.message);
            }
        }
    }
    console.log('[MIGRATE] Tabelas criadas com sucesso!');
    // Seed do usuário Admin Padrão
    const adminExist = await (0, db_1.queryOne)('SELECT * FROM usuarios WHERE matricula = ?', ['999999']);
    if (!adminExist) {
        const hash = await bcryptjs_1.default.hash('123456', 10);
        await (0, db_1.query)('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)', ['ADMINISTRADOR CASA DA LANTERNA', '999999', hash, 'ADMINISTRADOR', 'ATIVO']);
        console.log('[SEED] Usuário Admin padrão criado: Matrícula 999999 / Senha 123456');
    }
    // Seed de Operador Padrão
    const operadorExist = await (0, db_1.queryOne)('SELECT * FROM usuarios WHERE matricula = ?', ['1001']);
    if (!operadorExist) {
        const hash = await bcryptjs_1.default.hash('123456', 10);
        await (0, db_1.query)('INSERT INTO usuarios (nome, matricula, senha_hash, nivel_acesso, status) VALUES (?, ?, ?, ?, ?)', ['OPERADOR DE BALCÃO', '1001', hash, 'OPERADOR', 'ATIVO']);
        console.log('[SEED] Usuário Operador criado: Matrícula 1001 / Senha 123456');
    }
    // Seed de Categorias Padrão
    const categoriasPadrao = ['Iluminação', 'Comunicação', 'Detecção de Gás', 'Segurança', 'Operação LHD', 'Ferramentas'];
    for (const cat of categoriasPadrao) {
        const catExist = await (0, db_1.queryOne)('SELECT * FROM categorias WHERE nome = ?', [cat]);
        if (!catExist) {
            await (0, db_1.query)('INSERT INTO categorias (nome, descricao) VALUES (?, ?)', [cat, `Categoria ${cat}`]);
        }
    }
    // Seed de Colaboradores Iniciais (se vazio)
    const colabCount = await (0, db_1.queryOne)('SELECT COUNT(*) as count FROM colaboradores');
    if (colabCount && (colabCount.count === 0 || colabCount.count === undefined)) {
        const colaboradoresSeed = [
            { nome: 'ENZO DE OLIVEIRA FIRMO', matricula: '99300922', setor: 'OPERAÇÃO', cargo: 'Operador de LHD', nfc: '00270584711361' },
            { nome: 'JOÃO DA SILVA', matricula: '001245', setor: 'MINA SUBTERRÂNEA', cargo: 'Técnico de Mineração', nfc: '00270584711362' },
            { nome: 'CARLOS SILVA', matricula: '001246', setor: 'MANUTENÇÃO', cargo: 'Eletricista Industrial', nfc: '00270584711363' },
            { nome: 'MARIA APARECIDA', matricula: '001247', setor: 'SEGURANÇA', cargo: 'Técnica de Segurança', nfc: '00270584711364' }
        ];
        for (const c of colaboradoresSeed) {
            await (0, db_1.query)('INSERT INTO colaboradores (nome, matricula, setor, cargo, nfc_id, status) VALUES (?, ?, ?, ?, ?, ?)', [c.nome, c.matricula, c.setor, c.cargo, c.nfc, 'ATIVO']);
        }
        console.log('[SEED] Colaboradores iniciais criados com sucesso!');
    }
    // Seed de Materiais Iniciais (se vazio)
    const matCount = await (0, db_1.queryOne)('SELECT COUNT(*) as count FROM materiais');
    if (matCount && (matCount.count === 0 || matCount.count === undefined)) {
        const catIluminacao = await (0, db_1.queryOne)('SELECT id FROM categorias WHERE nome = ?', ['Iluminação']);
        const catComunicao = await (0, db_1.queryOne)('SELECT id FROM categorias WHERE nome = ?', ['Comunicação']);
        const catOperacao = await (0, db_1.queryOne)('SELECT id FROM categorias WHERE nome = ?', ['Operação LHD']);
        const catDeteccao = await (0, db_1.queryOne)('SELECT id FROM categorias WHERE nome = ?', ['Detecção de Gás']);
        const materiaisSeed = [
            { nome: 'Lanterna de Capacete LED', codigo: 'LAT-001', cat: catIluminacao?.id || 1, status: 'DISPONIVEL', patrimonio: 'PAT-10001' },
            { nome: 'Lanterna de Capacete LED', codigo: 'LAT-002', cat: catIluminacao?.id || 1, status: 'DISPONIVEL', patrimonio: 'PAT-10002' },
            { nome: 'Lanterna de Capacete LED', codigo: 'LAT-003', cat: catIluminacao?.id || 1, status: 'DISPONIVEL', patrimonio: 'PAT-10003' },
            { nome: 'Rádio HT Digital Subterrâneo', codigo: 'RAD-001', cat: catComunicao?.id || 2, status: 'DISPONIVEL', patrimonio: 'PAT-20001' },
            { nome: 'Rádio HT Digital Subterrâneo', codigo: 'RAD-002', cat: catComunicao?.id || 2, status: 'DISPONIVEL', patrimonio: 'PAT-20002' },
            { nome: 'Controle Remoto LHD Caterpillar', codigo: 'LHD-001', cat: catOperacao?.id || 5, status: 'DISPONIVEL', patrimonio: 'PAT-30001' },
            { nome: 'Controle Remoto LHD Caterpillar', codigo: 'LHD-002', cat: catOperacao?.id || 5, status: 'DISPONIVEL', patrimonio: 'PAT-30002' },
            { nome: 'Detector Mutigás MX4', codigo: 'DET-001', cat: catDeteccao?.id || 3, status: 'DISPONIVEL', patrimonio: 'PAT-40001' },
            { nome: 'Detector Mutigás MX4', codigo: 'DET-002', cat: catDeteccao?.id || 3, status: 'MANUTENCAO', patrimonio: 'PAT-40002', obs: 'Sensor de H2S necessita calibração' }
        ];
        for (const m of materiaisSeed) {
            await (0, db_1.query)('INSERT INTO materiais (nome, codigo_interno, codigo_barras, categoria_id, patrimonio, status, observacao) VALUES (?, ?, ?, ?, ?, ?, ?)', [m.nome, m.codigo, m.codigo, m.cat, m.patrimonio, m.status, m.obs || '']);
        }
        console.log('[SEED] Materiais individuais criados com sucesso!');
    }
}
if (require.main === module) {
    runMigrations()
        .then(() => {
        console.log('[MIGRATE] Migração executada.');
        process.exit(0);
    })
        .catch((err) => {
        console.error('[MIGRATE] Erro fatal na migração:', err);
        process.exit(1);
    });
}
