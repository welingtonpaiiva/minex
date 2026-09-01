import { Router } from 'express';
import { EmprestimoController } from '../controllers/EmprestimoController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/ativos', EmprestimoController.buscarEmprestimosAtivos);
router.get('/colaborador/:colaboradorId', EmprestimoController.buscarEmprestimosDoColaborador);
router.post('/saida', requireRole(['ADMINISTRADOR', 'OPERADOR']), EmprestimoController.realizarSaida);
router.post('/entrada', requireRole(['ADMINISTRADOR', 'OPERADOR']), EmprestimoController.realizarEntrada);

export default router;
