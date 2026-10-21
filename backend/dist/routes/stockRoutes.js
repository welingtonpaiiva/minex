"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const db_1 = require("../config/db");
const OperationalService_1 = require("../services/OperationalService");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authMiddleware);
router.get('/', async (req, res, next) => {
    try {
        const p = (0, OperationalService_1.pagination)(req.query), params = [];
        let where = "WHERE m.tipo_controle = 'INDIVIDUAL'";
        if (req.query.busca) {
            where += ' AND (m.nome LIKE ? OR m.codigo_interno LIKE ? OR col.nome LIKE ? OR col.matricula LIKE ?)';
            params.push(...Array(4).fill('%' + String(req.query.busca).slice(0, 255) + '%'));
        }
        if (req.query.status) {
            where += ' AND m.status = ?';
            params.push(req.query.status);
        }
        if (req.query.categoria_id) {
            where += ' AND m.categoria_id = ?';
            params.push(Number(req.query.categoria_id));
        }
        const from = `FROM materiais m LEFT JOIN categorias c ON c.id=m.categoria_id
      LEFT JOIN emprestimos e ON e.material_id=m.id LEFT JOIN colaboradores col ON col.id=e.colaborador_id`;
        const items = await (0, db_1.query)(`SELECT m.*, c.nome AS categoria_nome, col.nome AS colaborador_nome,
      col.matricula AS colaborador_matricula, e.data_hora_saida, e.id AS emprestimo_id ${from} ${where} ORDER BY m.codigo_interno LIMIT ? OFFSET ?`, [...params, p.limit, p.offset]);
        const total = await (0, db_1.queryOne)(`SELECT COUNT(*) AS total ${from} ${where}`, params);
        const counts = await (0, db_1.query)("SELECT status, COUNT(*) AS total FROM materiais WHERE tipo_controle='INDIVIDUAL' GROUP BY status");
        res.json({ items, total: total.total, ...p, contadores: Object.fromEntries(counts.map(c => [c.status, c.total])) });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
