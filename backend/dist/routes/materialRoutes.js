"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const MaterialController_1 = require("../controllers/MaterialController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const OperationalService_1 = require("../services/OperationalService");
const MaterialService_1 = require("../services/MaterialService");
const MaterialBatchService_1 = require("../services/MaterialBatchService");
const MaterialLabels_1 = require("../services/MaterialLabels");
const MaterialPhotos_1 = require("../services/MaterialPhotos");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/fotos/catalogo', (_req, res) => res.json((0, MaterialPhotos_1.availableMaterialPhotos)()));
router.get('/fotos/:arquivo', async (req, res, next) => {
    try {
        const content = await (0, MaterialPhotos_1.readMaterialPhoto)(req.params.arquivo);
        if (!content)
            return res.sendStatus(404);
        res.set('Cache-Control', 'private, no-store').type('image/webp').send(content);
    }
    catch (error) {
        next(error);
    }
});
router.post('/:id/foto', (0, authMiddleware_1.requireRole)(OperationalService_1.registrationRoles), async (req, res, next) => {
    try {
        res.json(await (0, MaterialPhotos_1.attachMaterialPhoto)((0, OperationalService_1.id)(req.params.id), req.body.imagem, req.user.id));
    }
    catch (error) {
        next(error);
    }
});
router.get('/etiquetas/teste', (0, authMiddleware_1.requireRole)(OperationalService_1.barcodeRoles), async (_req, res, next) => {
    try {
        res.type('application/pdf').set('Content-Disposition', 'inline; filename="teste-leitura-code128.pdf"').send(await (0, MaterialLabels_1.barcodePrintTest)());
    }
    catch (error) {
        next(error);
    }
});
router.post('/etiquetas', (0, authMiddleware_1.requireRole)(OperationalService_1.barcodeRoles), async (req, res, next) => {
    try {
        res.type('application/pdf').set('Content-Disposition', 'inline; filename="etiquetas-mina-ug.pdf"').send(await (0, MaterialLabels_1.materialLabels)(req.body));
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/codigo-barras', (0, authMiddleware_1.requireRole)(OperationalService_1.barcodeRoles), async (req, res, next) => {
    try {
        res.json(await MaterialService_1.MaterialService.vincularCodigoBarras((0, OperationalService_1.id)(req.params.id), req.body.codigo_barras, req.user.id));
    }
    catch (error) {
        next(error);
    }
});
router.post('/lote/previa', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR']), async (req, res, next) => {
    try {
        res.json(await (0, MaterialBatchService_1.previewBatch)(req.body));
    }
    catch (error) {
        next(error);
    }
});
router.post('/lote', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR']), async (req, res, next) => {
    try {
        res.json(await (0, MaterialBatchService_1.createBatch)(req.body, req.user.id));
    }
    catch (error) {
        next(error);
    }
});
router.get('/patrimonio-mina-ug/previa', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR']), async (_req, res, next) => {
    try {
        res.json(await (0, MaterialBatchService_1.previewPatrimony)());
    }
    catch (error) {
        next(error);
    }
});
router.post('/patrimonio-mina-ug', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR']), async (req, res, next) => {
    try {
        res.json(await (0, MaterialBatchService_1.applyPatrimony)(req.body, req.user.id));
    }
    catch (error) {
        next(error);
    }
});
router.get('/categorias', MaterialController_1.MaterialController.listarCategorias);
router.get('/', MaterialController_1.MaterialController.listar);
router.get('/codigo/:codigo', MaterialController_1.MaterialController.buscarPorCodigo);
router.get('/:id', MaterialController_1.MaterialController.buscarPorId);
router.post('/', (0, authMiddleware_1.requireRole)(OperationalService_1.registrationRoles), MaterialController_1.MaterialController.criar);
router.put('/:id', (0, authMiddleware_1.requireRole)(OperationalService_1.registrationRoles), MaterialController_1.MaterialController.editar);
router.patch('/:id/conferencia', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), async (req, res, next) => {
    try {
        res.json(await MaterialService_1.MaterialService.conferir((0, OperationalService_1.id)(req.params.id), req.body.status, req.body.observacao, req.user.id));
    }
    catch (error) {
        next(error);
    }
});
router.patch('/:id/status', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR', 'SUPERVISOR']), MaterialController_1.MaterialController.alterarStatus);
router.delete('/:id', (0, authMiddleware_1.requireRole)(['ADMINISTRADOR']), MaterialController_1.MaterialController.excluir);
exports.default = router;
