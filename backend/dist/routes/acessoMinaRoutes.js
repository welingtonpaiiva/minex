"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AcessoMinaController_1 = require("../controllers/AcessoMinaController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const router = (0, express_1.Router)();
// Todas as rotas de acesso precisam de autenticação
router.use(authMiddleware_1.authMiddleware);
router.get('/ativos', AcessoMinaController_1.AcessoMinaController.buscarAtivos);
router.get('/historico', AcessoMinaController_1.AcessoMinaController.buscarHistorico);
exports.default = router;
