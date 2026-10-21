import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { registrationRoles } from '../services/OperationalService';

const router = Router();

router.use(authMiddleware);

router.get('/categorias', MaterialController.listarCategorias);
router.get('/', MaterialController.listar);
router.get('/codigo/:codigo', MaterialController.buscarPorCodigo);
router.get('/:id', MaterialController.buscarPorId);
router.post('/', requireRole(registrationRoles), MaterialController.criar);
router.put('/:id', requireRole(registrationRoles), MaterialController.editar);
router.patch('/:id/status', requireRole(['ADMINISTRADOR', 'SUPERVISOR']), MaterialController.alterarStatus);
router.delete('/:id', requireRole(['ADMINISTRADOR']), MaterialController.excluir);

export default router;
