import { Router } from 'express';
import { RelatorioController } from '../controllers/RelatorioController';
import { authMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/resumo', RelatorioController.obterResumo);
router.get('/excel', RelatorioController.exportarExcel);
router.get('/pdf/em-uso', RelatorioController.exportarPdfEmUso);

export default router;
