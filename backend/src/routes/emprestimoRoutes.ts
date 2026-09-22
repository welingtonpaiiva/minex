import { Router } from 'express';
import { EmprestimoController } from '../controllers/EmprestimoController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/ativos', EmprestimoController.buscarEmprestimosAtivos);
router.get('/alertas-turno', EmprestimoController.buscarAlertasTurno);
router.get('/colaborador/:colaboradorId', EmprestimoController.buscarEmprestimosDoColaborador);
router.post('/saida', requireRole(['ADMINISTRADOR', 'OPERADOR']), EmprestimoController.realizarSaida);
router.post('/entrada', requireRole(['ADMINISTRADOR', 'OPERADOR']), EmprestimoController.realizarEntrada);
router.post('/extravio', requireRole(['ADMINISTRADOR', 'OPERADOR']), EmprestimoController.realizarExtravio);

export default router;
