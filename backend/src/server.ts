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

dotenv.config();

const app = express();
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
  res.status(500).json({ error: err.message || 'Erro interno no servidor' });
});

// Inicialização
async function startServer() {
  try {
    await runMigrations();
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

startServer();
