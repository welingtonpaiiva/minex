import { Router } from 'express';
import { EmprestimoController } from '../controllers/EmprestimoController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { operationRoles } from '../services/OperationalService';

const router = Router();

router.use(authMiddleware);

router.get('/ativos', EmprestimoController.buscarEmprestimosAtivos);
router.get('/alertas-turno', EmprestimoController.buscarAlertasTurno);
router.get('/colaborador/:colaboradorId', EmprestimoController.buscarEmprestimosDoColaborador);
router.post('/saida', requireRole(operationRoles), EmprestimoController.realizarSaida);
router.post('/entrada', requireRole(operationRoles), EmprestimoController.realizarEntrada);

export default router;
