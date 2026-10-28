"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const EmprestimoController_1 = require("../controllers/EmprestimoController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const OperationalService_1 = require("../services/OperationalService");
const ReturnService_1 = require("../services/ReturnService");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/pendencias', async (req, res, next) => {
    try {
        res.json(await (0, ReturnService_1.pendingReturns)(req.query));
    }
    catch (error) {
        next(error);
    }
});
router.post('/entrada-rapida', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), async (req, res, next) => {
    try {
        res.json(await (0, ReturnService_1.quickReturn)({ ...req.body, requestId: req.header('Idempotency-Key') || req.body.requestId }, req.user.id));
    }
    catch (error) {
        next(error);
    }
});
router.get('/ativos', EmprestimoController_1.EmprestimoController.buscarEmprestimosAtivos);
router.get('/alertas-turno', EmprestimoController_1.EmprestimoController.buscarAlertasTurno);
router.get('/colaborador/:colaboradorId', EmprestimoController_1.EmprestimoController.buscarEmprestimosDoColaborador);
router.post('/saida', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), EmprestimoController_1.EmprestimoController.realizarSaida);
router.post('/entrada', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), EmprestimoController_1.EmprestimoController.realizarEntrada);
exports.default = router;
