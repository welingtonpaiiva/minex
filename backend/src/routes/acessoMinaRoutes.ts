import { Router } from 'express';
import { AcessoMinaController } from '../controllers/AcessoMinaController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

// Todas as rotas de acesso precisam de autenticação
router.use(authMiddleware);

router.get('/ativos', AcessoMinaController.buscarAtivos);
router.get('/historico', AcessoMinaController.buscarHistorico);

export default router;
