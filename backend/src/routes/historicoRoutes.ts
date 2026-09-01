import { Router } from 'express';
import { HistoricoController } from '../controllers/HistoricoController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', HistoricoController.listar);
router.get('/colaborador/:colaboradorId', HistoricoController.historicoColaborador);
router.get('/material/:materialId', HistoricoController.historicoMaterial);

export default router;
