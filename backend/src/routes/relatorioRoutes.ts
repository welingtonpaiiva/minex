import { Router } from 'express';
import { RelatorioController } from '../controllers/RelatorioController';
import { authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { reportRoles } from '../services/OperationalService';

const router = Router();

router.use(authMiddleware, requireRole(reportRoles));

router.get('/resumo', RelatorioController.obterResumo);
router.get('/excel', RelatorioController.exportarExcel);
router.get('/pdf/em-uso', RelatorioController.exportarPdfEmUso);

export default router;
