import { Router } from 'express';
import { ColaboradorController } from '../controllers/ColaboradorController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { registrationRoles } from '../services/OperationalService';

const router = Router();

router.use(authMiddleware);

router.get('/', ColaboradorController.listar);
router.get('/nfc/:nfcId', ColaboradorController.buscarPorNfc);
router.get('/matricula/:matricula', ColaboradorController.buscarPorMatricula);
router.get('/:id', ColaboradorController.buscarPorId);
router.post('/', requireRole(registrationRoles), ColaboradorController.criar);
router.put('/:id', requireRole(registrationRoles), ColaboradorController.editar);
router.patch('/:id/nfc', requireRole(registrationRoles), ColaboradorController.associarNfc);

export default router;
