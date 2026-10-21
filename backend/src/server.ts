import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { runMigrations } from './database/migrate';

import authRoutes from './routes/authRoutes';
import colaboradorRoutes from './routes/colaboradorRoutes';
import materialRoutes from './routes/materialRoutes';
import emprestimoRoutes from './routes/emprestimoRoutes';
import historicoRoutes from './routes/historicoRoutes';
import relatorioRoutes from './routes/relatorioRoutes';
import operationalRoutes from './routes/operationalRoutes';
import photoRoutes from './routes/photoRoutes';
import stockRoutes from './routes/stockRoutes';
import quantityRoutes from './routes/quantityRoutes';
import kitRoutes from './routes/kitRoutes';
import { queryOne, databaseClient } from './config/db';
import { backupMysql } from './database/backup';

dotenv.config();

export const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger simples
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// Rotas da API REST
app.use('/api/auth', authRoutes);
app.use('/api/colaboradores', colaboradorRoutes);
app.use('/api/materiais', materialRoutes);
app.use('/api/emprestimos', emprestimoRoutes);
app.use('/api/historico', historicoRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/operacao', operationalRoutes);
app.use('/api/estoque', stockRoutes);
app.use('/api/quantidades', quantityRoutes);
app.use('/api/fotos', photoRoutes);
app.use('/api/kits', kitRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Recurso não encontrado' }));

// Servir frontend compilado em produção se existir
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req: Request, res: Response) => {
  if (!req.url.startsWith('/api')) {
    res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
      if (err) {
        res.status(200).send('API da Casa da Lanterna operacional.');
      }
    });
  }
});

// Tratador global de erros
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ERRO SERVIDOR]', err);
  const unavailable = ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'SQLITE_BUSY', 'ER_CON_COUNT_ERROR'].includes(err.code);
  const duplicate = err.code === 'ER_DUP_ENTRY' || err.code === 'SQLITE_CONSTRAINT';
  res.status(unavailable ? 503 : duplicate ? 409 : 400).json({ error: unavailable ? 'Banco indisponível. Aguarde e tente novamente.' : duplicate ? 'O registro já existe ou está vinculado a outra operação.' : err.message || 'Erro ao processar a operação' });
});

// Inicialização
async function startServer() {
  try {
    if (process.env.RUN_MIGRATIONS === '0') {
      const migration = await queryOne('SELECT MAX(version) AS version FROM schema_migrations');
      if (Number(migration?.version) < 5) throw new Error('Execute as migrations antes de iniciar a aplicação');
    } else await runMigrations();
    if (databaseClient === 'mysql' && Number(process.env.BACKUP_INTERVAL_HOURS) > 0) {
      let running = false;
      const timer = setInterval(async () => {
        if (running) return; running = true;
        try { await backupMysql(); } catch (error: any) { console.error('[BACKUP] Falha:', error.message); } finally { running = false; }
      }, Number(process.env.BACKUP_INTERVAL_HOURS) * 3600000);
      timer.unref();
    }
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(` CASA DA LANTERNA - SERVIDOR INDUSTRIAL ATIVO        `);
      console.log(` Porta: ${PORT}`);
      console.log(` API Endpoint: http://localhost:${PORT}/api          `);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Falha fatal ao iniciar o servidor:', err);
    process.exit(1);
  }
}

if (require.main === module) startServer();
