import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.post('/login', AuthController.login);
router.get('/me', authMiddleware, AuthController.me);
router.get('/usuarios', authMiddleware, requireRole(['ADMINISTRADOR']), AuthController.listarUsuarios);
router.post('/usuarios', authMiddleware, requireRole(['ADMINISTRADOR']), AuthController.criarUsuario);

export default router;
