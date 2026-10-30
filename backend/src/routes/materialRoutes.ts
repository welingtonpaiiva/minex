import { Router } from 'express';
import { MaterialController } from '../controllers/MaterialController';
import { AuthenticatedRequest, authMiddleware, requireRole } from '../middlewares/authMiddleware';
import { barcodeRoles, registrationRoles, operationRoles, id } from '../services/OperationalService';
import { MaterialService } from '../services/MaterialService';
import { previewBatch, createBatch, previewPatrimony, applyPatrimony } from '../services/MaterialBatchService';
import { barcodePrintTest, materialLabels } from '../services/MaterialLabels';
import { availableMaterialPhotos, attachMaterialPhoto, readMaterialPhoto } from '../services/MaterialPhotos';

const router = Router();

router.use(authMiddleware);
router.get('/fotos/catalogo', (_req, res) => res.json(availableMaterialPhotos()));
router.get('/fotos/:arquivo', async (req, res, next) => {
  try { const content = await readMaterialPhoto(req.params.arquivo); if (!content) return res.sendStatus(404);
    res.set('Cache-Control', 'private, no-store').type('image/webp').send(content);
  } catch (error) { next(error); }
});
router.post('/:id/foto', requireRole(registrationRoles), async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await attachMaterialPhoto(id(req.params.id), req.body.imagem, req.user!.id)); } catch (error) { next(error); }
});
router.get('/etiquetas/teste', requireRole(barcodeRoles), async (_req, res, next) => {
  try { res.type('application/pdf').set('Content-Disposition', 'inline; filename="teste-leitura-code128.pdf"').send(await barcodePrintTest()); }
  catch (error) { next(error); }
});
router.post('/etiquetas', requireRole(barcodeRoles), async (req, res, next) => {
  try { res.type('application/pdf').set('Content-Disposition', 'inline; filename="etiquetas-mina-ug.pdf"').send(await materialLabels(req.body)); }
  catch (error) { next(error); }
});
router.patch('/:id/codigo-barras', requireRole(barcodeRoles), async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await MaterialService.vincularCodigoBarras(id(req.params.id), req.body.codigo_barras, req.user!.id)); }
  catch (error) { next(error); }
});

router.post('/lote/previa', requireRole(['ADMINISTRADOR']), async (req, res, next) => {
  try { res.json(await previewBatch(req.body)); } catch (error) { next(error); }
});
router.post('/lote', requireRole(['ADMINISTRADOR']), async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await createBatch(req.body, req.user!.id)); } catch (error) { next(error); }
});
router.get('/patrimonio-mina-ug/previa', requireRole(['ADMINISTRADOR']), async (_req, res, next) => {
  try { res.json(await previewPatrimony()); } catch (error) { next(error); }
});
router.post('/patrimonio-mina-ug', requireRole(['ADMINISTRADOR']), async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await applyPatrimony(req.body, req.user!.id)); } catch (error) { next(error); }
});
router.get('/categorias', MaterialController.listarCategorias);
router.get('/', MaterialController.listar);
router.get('/codigo/:codigo', MaterialController.buscarPorCodigo);
router.get('/:id', MaterialController.buscarPorId);
router.post('/', requireRole(registrationRoles), MaterialController.criar);
router.put('/:id', requireRole(registrationRoles), MaterialController.editar);
router.patch('/:id/conferencia', requireRole(operationRoles), async (req: AuthenticatedRequest, res, next) => {
  try { res.json(await MaterialService.conferir(id(req.params.id), req.body.status, req.body.observacao, req.user!.id)); }
  catch (error) { next(error); }
});
router.patch('/:id/status', requireRole(['ADMINISTRADOR', 'SUPERVISOR']), MaterialController.alterarStatus);
router.delete('/:id', requireRole(['ADMINISTRADOR']), MaterialController.excluir);

export default router;
