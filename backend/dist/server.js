"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const migrate_1 = require("./database/migrate");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const colaboradorRoutes_1 = __importDefault(require("./routes/colaboradorRoutes"));
const materialRoutes_1 = __importDefault(require("./routes/materialRoutes"));
const emprestimoRoutes_1 = __importDefault(require("./routes/emprestimoRoutes"));
const historicoRoutes_1 = __importDefault(require("./routes/historicoRoutes"));
const relatorioRoutes_1 = __importDefault(require("./routes/relatorioRoutes"));
const operationalRoutes_1 = __importDefault(require("./routes/operationalRoutes"));
const photoRoutes_1 = __importDefault(require("./routes/photoRoutes"));
const stockRoutes_1 = __importDefault(require("./routes/stockRoutes"));
const quantityRoutes_1 = __importDefault(require("./routes/quantityRoutes"));
const db_1 = require("./config/db");
const backup_1 = require("./database/backup");
dotenv_1.default.config();
exports.app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json({ limit: '10mb' }));
exports.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Logger simples
exports.app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});
// Rotas da API REST
exports.app.use('/api/auth', authRoutes_1.default);
exports.app.use('/api/colaboradores', colaboradorRoutes_1.default);
exports.app.use('/api/materiais', materialRoutes_1.default);
exports.app.use('/api/emprestimos', emprestimoRoutes_1.default);
exports.app.use('/api/historico', historicoRoutes_1.default);
exports.app.use('/api/relatorios', relatorioRoutes_1.default);
exports.app.use('/api/operacao', operationalRoutes_1.default);
exports.app.use('/api/estoque', stockRoutes_1.default);
exports.app.use('/api/quantidades', quantityRoutes_1.default);
exports.app.use('/api/fotos', photoRoutes_1.default);
exports.app.use('/api', (_req, res) => res.status(404).json({ error: 'Recurso não encontrado' }));
// Servir frontend compilado em produção se existir
const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
exports.app.use(express_1.default.static(frontendDist));
exports.app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(path_1.default.join(frontendDist, 'index.html'), (err) => {
            if (err) {
                res.status(200).send('API da Casa da Lanterna operacional.');
            }
        });
    }
});
// Tratador global de erros
exports.app.use((err, req, res, next) => {
    console.error('[ERRO SERVIDOR]', err);
    const unavailable = ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'SQLITE_BUSY', 'ER_CON_COUNT_ERROR'].includes(err.code);
    const duplicate = err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT';
    res.status(unavailable ? 503 : duplicate ? 409 : 400).json({ error: unavailable ? 'Banco indisponível. Aguarde e tente novamente.' : duplicate ? 'O registro já existe ou está vinculado a outra operação.' : err.message || 'Erro ao processar a operação' });
});
// Inicialização
async function startServer() {
    try {
        if (process.env.RUN_MIGRATIONS === '0') {
            const migration = await (0, db_1.queryOne)('SELECT MAX(version) AS version FROM schema_migrations');
            if (Number(migration?.version) < 4)
                throw new Error('Execute as migrations antes de iniciar a aplicação');
        }
        else
            await (0, migrate_1.runMigrations)();
        if (db_1.databaseClient === 'mysql' && Number(process.env.BACKUP_INTERVAL_HOURS) > 0) {
            let running = false;
            const timer = setInterval(async () => {
                if (running)
                    return;
                running = true;
                try {
                    await (0, backup_1.backupMysql)();
                }
                catch (error) {
                    console.error('[BACKUP] Falha:', error.message);
                }
                finally {
                    running = false;
                }
            }, Number(process.env.BACKUP_INTERVAL_HOURS) * 3600000);
            timer.unref();
        }
        exports.app.listen(PORT, () => {
            console.log(`=======================================================`);
            console.log(` CASA DA LANTERNA - SERVIDOR INDUSTRIAL ATIVO        `);
            console.log(` Porta: ${PORT}`);
            console.log(` API Endpoint: http://localhost:${PORT}/api          `);
            console.log(`=======================================================`);
        });
    }
    catch (err) {
        console.error('Falha fatal ao iniciar o servidor:', err);
        process.exit(1);
    }
}
if (require.main === module)
    startServer();
