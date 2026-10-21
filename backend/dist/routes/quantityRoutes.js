"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const db_1 = require("../config/db");
const QuantityService_1 = require("../services/QuantityService");
const OperationalService_1 = require("../services/OperationalService");
const MaterialService_1 = require("../services/MaterialService");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
const handle = (fn) => (req, res, next) => { Promise.resolve(fn(req, res)).catch(next); };
router.get('/', handle(async (req, res) => {
    const p = (0, OperationalService_1.pagination)(req.query), term = '%' + String(req.query.busca || '').slice(0, 255) + '%';
    const from = `FROM materiais m WHERE m.tipo_controle='QUANTIDADE' AND (m.nome LIKE ? OR m.codigo_interno LIKE ?)`;
    const items = await (0, db_1.query)(`SELECT m.*, COALESCE((SELECT SUM(e.quantidade-e.devolvida) FROM emprestimos_quantidade e WHERE e.material_id=m.id),0) AS em_operacao ${from} ORDER BY m.nome LIMIT ? OFFSET ?`, [term, term, p.limit, p.offset]);
    const total = await (0, db_1.queryOne)(`SELECT COUNT(*) AS total ${from}`, [term, term]);
    res.json({ items, total: total.total, ...p });
}));
router.get('/emprestimos', handle(async (req, res) => {
    const p = (0, OperationalService_1.pagination)(req.query), term = '%' + String(req.query.busca || '').slice(0, 255) + '%';
    const where = `WHERE e.quantidade>e.devolvida AND (c.nome LIKE ? OR c.matricula LIKE ? OR m.nome LIKE ? OR m.codigo_interno LIKE ?) AND (?='' OR c.id=?)`;
    const from = `FROM emprestimos_quantidade e JOIN materiais m ON m.id=e.material_id JOIN colaboradores c ON c.id=e.colaborador_id`;
    const params = [term, term, term, term, req.query.colaborador_id || '', req.query.colaborador_id || ''];
    const items = await (0, db_1.query)(`SELECT e.*, m.nome AS material_nome,m.codigo_interno,c.nome AS colaborador_nome,c.matricula,c.setor ${from} ${where} ORDER BY e.id DESC LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]);
    const total = await (0, db_1.queryOne)(`SELECT COUNT(*) AS total ${from} ${where}`, params);
    res.json({ items, total: total.total, ...p });
}));
router.post('/', (0, authMiddleware_1.requireRole)(OperationalService_1.registrationRoles), handle(async (req, res) => {
    const initial = Number(req.body.saldo_inicial || 0);
    if (!Number.isSafeInteger(initial) || initial < 0 || initial > 1000000)
        throw new Error('Saldo inicial inválido');
    const result = await (0, db_1.withTransaction)(async (execute) => { const material = await MaterialService_1.MaterialService.criar(req.body); await execute("UPDATE materiais SET tipo_controle='QUANTIDADE',saldo_disponivel=? WHERE id=?", [initial, material.id]); await (0, OperationalService_1.audit)(req.user.id, 'CADASTRO_QUANTIDADE', 'material', material.id, { saldo_inicial: initial }, execute); return { ...material, tipo_controle: 'QUANTIDADE', saldo_disponivel: initial }; });
    res.status(201).json(result);
}));
router.post('/movimentar', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), handle(async (req, res) => {
    if (['AJUSTE', 'LIBERAR'].includes(req.body.tipo) && !['ADMINISTRADOR', 'SUPERVISOR'].includes(req.user.nivel_acesso))
        return res.status(403).json({ error: 'Ajustes e liberações exigem supervisor ou administrador' });
    res.json(await (0, QuantityService_1.quantityMove)({ ...req.body, requestId: req.header('Idempotency-Key') || req.body.requestId }, req.user.id));
}));
router.post('/extravios/:id', (0, authMiddleware_1.requireRole)(OperationalService_1.operationRoles), handle(async (req, res) => { res.json(await (0, OperationalService_1.updateLoss)(-(0, OperationalService_1.id)(req.params.id), req.body, req.user.id)); }));
exports.default = router;
