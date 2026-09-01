import { Router } from 'express';
import { ColaboradorController } from '../controllers/ColaboradorController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/', ColaboradorController.listar);
router.get('/nfc/:nfcId', ColaboradorController.buscarPorNfc);
router.get('/matricula/:matricula', ColaboradorController.buscarPorMatricula);
router.get('/:id', ColaboradorController.buscarPorId);
router.post('/', requireRole(['ADMINISTRADOR', 'OPERADOR']), ColaboradorController.criar);
router.put('/:id', requireRole(['ADMINISTRADOR', 'OPERADOR']), ColaboradorController.editar);
router.patch('/:id/nfc', requireRole(['ADMINISTRADOR', 'OPERADOR']), ColaboradorController.associarNfc);

export default router;
