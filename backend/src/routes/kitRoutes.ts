import { Router } from 'express';
import { KitController } from '../controllers/KitController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', KitController.listarKits);
router.post('/', requireRole(['ADMINISTRADOR', 'OPERADOR']), KitController.criarKit);
router.delete('/:id', requireRole(['ADMINISTRADOR', 'OPERADOR']), KitController.excluirKit);
router.post('/:id/atribuir', requireRole(['ADMINISTRADOR', 'OPERADOR']), KitController.atribuirKit);

export default router;
