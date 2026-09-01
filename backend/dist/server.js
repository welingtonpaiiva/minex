"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
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
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Logger simples
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    next();
});
// Rotas da API REST
app.use('/api/auth', authRoutes_1.default);
app.use('/api/colaboradores', colaboradorRoutes_1.default);
app.use('/api/materiais', materialRoutes_1.default);
app.use('/api/emprestimos', emprestimoRoutes_1.default);
app.use('/api/historico', historicoRoutes_1.default);
app.use('/api/relatorios', relatorioRoutes_1.default);
// Servir frontend compilado em produção se existir
const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
app.use(express_1.default.static(frontendDist));
app.get('*', (req, res) => {
    if (!req.url.startsWith('/api')) {
        res.sendFile(path_1.default.join(frontendDist, 'index.html'), (err) => {
            if (err) {
                res.status(200).send('API da Casa da Lanterna operacional.');
            }
        });
    }
});
// Tratador global de erros
app.use((err, req, res, next) => {
    console.error('[ERRO SERVIDOR]', err);
    res.status(500).json({ error: err.message || 'Erro interno no servidor' });
});
// Inicialização
async function startServer() {
    try {
        await (0, migrate_1.runMigrations)();
        app.listen(PORT, () => {
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
startServer();
