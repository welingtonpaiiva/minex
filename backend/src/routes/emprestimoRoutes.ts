import { Router } from 'express';
import { EmprestimoController } from '../controllers/EmprestimoController';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { operationRoles } from '../services/OperationalService';
import { materialHoldingOverview, pendingReturns, quickReturn } from '../services/ReturnService';
import { codeReturnPreview, returnByCode } from '../services/CodeReturnService';

const router = Router();

router.use(authMiddleware);

router.get('/alertas-posse', async (_req, res, next) => {
  try { res.setHeader('Cache-Control', 'private, no-store'); res.json(await materialHoldingOverview()); }
  catch (error) { next(error); }
});

router.get('/entrada-por-codigo/:codigo', requireRole(operationRoles), async (req, res, next) => {
  try { res.json(await codeReturnPreview(req.params.codigo)); } catch (error) { next(error); }
});
router.post('/entrada-por-codigo', requireRole(operationRoles), async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await returnByCode({ ...req.body, requestId: req.header('Idempotency-Key') || req.body.requestId }, req.user!.id)); }
  catch (error) { next(error); }
});

router.get('/pendencias', async (req, res, next) => {
  try { res.json(await pendingReturns(req.query)); } catch (error) { next(error); }
});
router.post('/entrada-rapida', requireRole(operationRoles), async (req: AuthenticatedRequest, res, next) => {
  try {
    res.json(await quickReturn({ ...req.body, requestId: req.header('Idempotency-Key') || req.body.requestId }, req.user!.id));
  } catch (error) { next(error); }
});

router.get('/ativos', EmprestimoController.buscarEmprestimosAtivos);
router.get('/alertas-turno', EmprestimoController.buscarAlertasTurno);
router.get('/colaborador/:colaboradorId', EmprestimoController.buscarEmprestimosDoColaborador);
router.post('/saida', requireRole(operationRoles), EmprestimoController.realizarSaida);
router.post('/entrada', requireRole(operationRoles), EmprestimoController.realizarEntrada);

export default router;
